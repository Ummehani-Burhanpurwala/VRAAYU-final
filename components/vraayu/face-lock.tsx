'use client'

import { useEffect, useRef, useState } from 'react'
import { LockKeyhole, ScanFace, X } from 'lucide-react'
import type { Lang } from '@/lib/types'
import { tr } from './common'

declare global {
  interface Window {
    faceapi?: any
  }
}

// face-api runs fully in the browser. Only a 128-number "signature" is stored, never a photo.
const VERSION = '1.7.15'
const SCRIPT = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSION}/dist/face-api.js`
const MODELS = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSION}/model/`

let loading: Promise<any> | null = null
function loadFaceApi(): Promise<any> {
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const boot = async () => {
      try {
        const f = window.faceapi
        await Promise.all([f.nets.tinyFaceDetector.loadFromUri(MODELS), f.nets.faceLandmark68Net.loadFromUri(MODELS), f.nets.faceRecognitionNet.loadFromUri(MODELS)])
        resolve(f)
      } catch (e) {
        loading = null
        reject(e)
      }
    }
    if (window.faceapi) return void boot()
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => void boot()
    s.onerror = () => {
      loading = null
      reject(new Error('Could not load the face library (check internet).'))
    }
    document.head.appendChild(s)
  })
  return loading
}

interface Props {
  mode: 'unlock' | 'enroll'
  lang: Lang
  descriptor?: number[]
  pin: string
  onUnlocked: () => void
  onEnrolled?: (d: number[]) => void
  onCancel?: () => void
}

export default function FaceLock({ mode, lang, descriptor, pin, onUnlocked, onEnrolled, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState(tr(lang, 'Starting camera…', 'कैमरा शुरू हो रहा है…', 'कॅमेरा सुरू होत आहे…'))
  const [failed, setFailed] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false
    const pinTimer = setTimeout(() => !cancelled && setShowPin(true), mode === 'unlock' ? 15000 : 600000)

    ;(async () => {
      try {
        const f = await loadFaceApi()
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 }, audio: false })
        if (cancelled) return
        const v = videoRef.current!
        v.srcObject = stream
        await v.play()
        setStatus(mode === 'enroll' ? tr(lang, 'Look straight at the camera…', 'सीधे कैमरे की ओर देखें…', 'सरळ कॅमेऱ्याकडे पाहा…') : tr(lang, 'Looking for your face…', 'आपका चेहरा खोज रहा हूँ…', 'तुमचा चेहरा शोधत आहे…'))

        const samples: number[][] = []
        let hits = 0
        const opts = new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        timer = setInterval(async () => {
          if (cancelled || v.readyState < 2) return
          const det = await f.detectSingleFace(v, opts).withFaceLandmarks().withFaceDescriptor()
          if (!det) return
          const d = Array.from(det.descriptor as Float32Array)
          if (mode === 'enroll') {
            samples.push(d)
            setStatus(`${tr(lang, 'Capturing', 'कैप्चर हो रहा है', 'नोंदवत आहे')} ${samples.length}/5`)
            if (samples.length >= 5) {
              clearInterval(timer!)
              const avg = d.map((_, i) => samples.reduce((a, s) => a + s[i], 0) / samples.length)
              onEnrolled?.(avg)
            }
          } else if (descriptor) {
            const dist = f.euclideanDistance(d, descriptor)
            hits = dist < 0.5 ? hits + 1 : 0
            if (hits >= 2) {
              clearInterval(timer!)
              setStatus(tr(lang, 'Welcome back!', 'वापसी पर स्वागत है!', 'पुन्हा स्वागत!'))
              onUnlocked()
            }
          }
        }, 600)
      } catch (e: any) {
        if (cancelled) return
        setFailed(true)
        setShowPin(true)
        setStatus(
          mode === 'enroll'
            ? tr(lang, 'Camera or face library unavailable. Allow camera access and check the internet.', 'कैमरा उपलब्ध नहीं है। कैमरा अनुमति दें और इंटरनेट जाँचें।', 'कॅमेरा उपलब्ध नाही. परवानगी द्या आणि इंटरनेट तपासा.')
            : tr(lang, 'Camera not available. Please use the family PIN.', 'कैमरा उपलब्ध नहीं। कृपया पारिवारिक PIN का उपयोग करें।', 'कॅमेरा उपलब्ध नाही. कृपया कौटुंबिक PIN वापरा.')
        )
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(pinTimer)
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submitPin() {
    if (pinValue === pin) onUnlocked()
    else {
      setPinError(true)
      setPinValue('')
    }
  }

  return (
    <div className="lock-screen" role="dialog" aria-modal="true">
      <div className="lock-card">
        {onCancel && (
          <button className="lock-close" aria-label="Close" onClick={onCancel}>
            <X />
          </button>
        )}
        <div className="lock-icon">{mode === 'unlock' ? <LockKeyhole /> : <ScanFace />}</div>
        <h2>{mode === 'unlock' ? tr(lang, 'Welcome to VRAAYU', 'VRAAYU में स्वागत है', 'VRAAYU मध्ये स्वागत') : tr(lang, 'Set up face unlock', 'फेस अनलॉक सेट करें', 'फेस अनलॉक सेट करा')}</h2>
        <p>{status}</p>
        {!failed && <video ref={videoRef} className="lock-video" muted playsInline />}
        {mode === 'unlock' && showPin && (
          <div className="lock-pin">
            <small>{tr(lang, 'Or enter the family PIN', 'या पारिवारिक PIN डालें', 'किंवा कौटुंबिक PIN टाका')}</small>
            <input
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={pinValue}
              onChange={(e) => {
                setPinValue(e.target.value)
                setPinError(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitPin()}
              aria-label="PIN"
              className={pinError ? 'bad' : ''}
            />
            <button className="button-secondary" onClick={submitPin}>
              {tr(lang, 'Unlock', 'अनलॉक', 'अनलॉक')}
            </button>
            {pinError && <small style={{ color: 'var(--danger)' }}>{tr(lang, 'Wrong PIN', 'गलत PIN', 'चुकीचा PIN')}</small>}
          </div>
        )}
      </div>
    </div>
  )
}
