'use client'

import { useState } from 'react'
import { LockKeyhole, MessageCircle, Phone, Plus, Trash2, HeartPulse } from 'lucide-react'
import type { AppState, Contact, Lang } from '@/lib/types'
import { normalizePhone, removeContact, uid, upsertContact } from '@/lib/store'
import { tr } from './common'

const COLORS = ['peach', 'blue', 'green']

interface Props {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  onCall: (c: Contact) => void
  onMessage: (c: Contact) => void
}

export default function ConnectView({ state, update, onCall, onMessage }: Props) {
  const lang: Lang = state.settings.language
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [phone, setPhone] = useState('')

  return (
    <div className="page-view">
      <div className="section-intro">
        <div>
          <p className="eyebrow">{tr(lang, 'Stay Close to Loved Ones', 'अपनों के करीब रहें', 'आपल्या माणसांच्या जवळ रहा')}</p>
          <h2>{tr(lang, 'Live Connect', 'लाइव कनेक्ट', 'लाइव्ह कनेक्ट')}</h2>
          <p>{tr(lang, 'Real phone calls and WhatsApp messages with one tap. Save each phone number with the country code (e.g. +91…).', 'एक टैप में असली फोन कॉल और WhatsApp संदेश। हर नंबर देश कोड (+91…) के साथ सहेजें।', 'एका टॅपमध्ये खरे फोन कॉल आणि WhatsApp संदेश. प्रत्येक नंबर देश कोडसह (+91…) जतन करा.')}</p>
        </div>
        <div className="secure-label"><LockKeyhole /> Private &amp; secure</div>
      </div>

      <div className="connect-list">
        {state.contacts.map((c, i) => (
          <div className="contact-card" key={c.id} style={{ flexWrap: 'wrap' }}>
            <div className={`contact-avatar ${COLORS[i % 3]}`}>{c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="contact-details">
              <strong>{c.name}</strong>
              <span><i className="online-dot" />{c.relation}</span>
              <input
                defaultValue={c.phone}
                key={c.phone}
                placeholder="+91XXXXXXXXXX"
                aria-label={`Phone for ${c.name}`}
                onBlur={(e) => {
                  const v = normalizePhone(e.target.value)
                  if (v !== c.phone) update((s) => upsertContact(s, { ...c, phone: v }))
                }}
                style={{ marginTop: 6, padding: '7px 10px', border: '1px solid #d5dce8', borderRadius: 9, width: 190, fontSize: 14 }}
              />
              {!c.phone && <span className="badge-soft warn" style={{ marginTop: 6 }}>{tr(lang, 'Add phone number', 'नंबर जोड़ें', 'नंबर जोडा')}</span>}
            </div>
            <button className="icon-action" aria-label={`Call ${c.name}`} onClick={() => onCall(c)}><Phone /></button>
            <button className="icon-action message-action" aria-label={`WhatsApp ${c.name}`} onClick={() => onMessage(c)}><MessageCircle /></button>
            <button className="icon-mini" aria-label={`Remove ${c.name}`} onClick={() => update((s) => removeContact(s, c.id))}><Trash2 /></button>
          </div>
        ))}
      </div>

      <form
        className="mini-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          update((s) => upsertContact(s, { id: uid(), name: name.trim(), relation: relation.trim() || 'Family', phone: normalizePhone(phone) }))
          setName(''); setRelation(''); setPhone('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr(lang, 'Name', 'नाम', 'नाव')} aria-label="Name" />
        <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder={tr(lang, 'Relation (Son, Neighbour…)', 'रिश्ता', 'नाते')} aria-label="Relation" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" inputMode="tel" aria-label="Phone" />
        <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Add contact', 'संपर्क जोड़ें', 'संपर्क जोडा')}</button>
      </form>

      <div className="connect-note">
        <HeartPulse />
        <span><strong>{tr(lang, 'Connection is medicine.', 'जुड़ाव ही दवा है।', 'जिव्हाळा हेच औषध.')}</strong> {tr(lang, 'A short chat with family brightens any afternoon.', 'परिवार से छोटी बात भी दिन बना देती है।', 'कुटुंबाशी छोटे बोलणेही दिवस उजळवते.')}</span>
      </div>
    </div>
  )
}
