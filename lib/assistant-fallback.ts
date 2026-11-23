// Offline / no-key brain. It reads the elder's REAL data (context) and never loops on one sentence.
import type { AssistantAction, AssistantContext, AssistantResult, Lang, ReadingKind, Section, TaskKind } from './types'
import { getNews, getWeather } from './server/tools'

type L3 = { en: string; hi: string; mr: string }
const t = (lang: Lang, s: L3) => s[lang]
const has = (q: string, words: string[]) => words.some((w) => q.includes(w))
const fmt12 = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function parseTime(q: string): string | null {
  const m = q.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (/p/i.test(m[3])) h += 12
    return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
  }
  const hi = q.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:बजे|वाजता|वाजले)/)
  if (hi) {
    let h = Number(hi[1])
    const evening = has(q, ['शाम', 'रात', 'संध्याकाळ', 'सायंकाळ', 'दुपार'])
    if (evening && h < 12) h += 12
    return `${String(h % 24).padStart(2, '0')}:${hi[2] ?? '00'}`
  }
  const plain = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i)
  if (plain) {
    let h = Number(plain[1])
    if (h <= 6) h += 12
    return `${String(h).padStart(2, '0')}:${plain[2] ?? '00'}`
  }
  return null
}

function reminderTitle(q: string): string {
  const cleaned = q
    .replace(/(remind me|please|set (a )?reminder|to|at|for)\b/gi, ' ')
    .replace(/(\d{1,2})([:.]\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/gi, ' ')
    .replace(/(मुझे|याद दिलाओ|याद दिलाना|रिमाइंडर|बजे|वाजता|आठवण करा|मला)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Reminder'
}

function kindOf(q: string): TaskKind {
  if (has(q, ['tablet', 'pill', 'medicine', 'दवा', 'गोली', 'औषध', 'गोळी'])) return 'medicine'
  if (has(q, ['water', 'पानी', 'पाणी'])) return 'water'
  if (has(q, ['walk', 'सैर', 'फेरफटका'])) return 'walk'
  if (has(q, ['lunch', 'dinner', 'breakfast', 'खाना', 'जेवण', 'नाश्ता'])) return 'meal'
  return 'task'
}

const vary = <T,>(arr: T[], seed = ''): T => arr[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % arr.length]

export async function fallbackAssistant(
  message: string,
  lang: Lang,
  ctx: AssistantContext
): Promise<AssistantResult> {
  const q = message.toLowerCase().trim()
  const out = (reply: string, actions: AssistantAction[] = [], suggestedReplies?: string[]): AssistantResult => ({
    reply,
    actions,
    suggestedReplies: suggestedReplies ?? defaultSuggestions(lang),
    source: 'engine',
    language: lang,
  })
  const nav = (section: Section): AssistantAction => ({ type: 'NAVIGATE', section })
  const name = ctx.name.split(' ')[0]

  // 1. Emergency
  if (/\bhelp me\b(?!\s+(set|call|find|with|to|remember|understand|choose|plan))/.test(q) || /\bsos\b/.test(q) || has(q, ['emergency', 'i fell', 'fallen', 'ambulance', 'chest pain', "can't breathe", 'मदद', 'आपातकाल', 'छाती में दर्द', 'मदत', 'आपत्कालीन', 'छातीत', 'बचाओ'])) {
    return out(
      t(lang, {
        en: `${name}, stay calm and breathe slowly. I am alerting your family right now.`,
        hi: `${name} जी, शांत रहिए और धीरे साँस लीजिए। मैं अभी आपके परिवार को सूचित कर रहा हूँ।`,
        mr: `${name}, शांत राहा आणि हळू श्वास घ्या. मी आत्ताच तुमच्या कुटुंबाला कळवत आहे.`,
      }),
      [{ type: 'EMERGENCY' }],
      t(lang, { en: 'I am okay now', hi: 'मैं ठीक हूँ', mr: 'मी ठीक आहे' }).split('|')
    )
  }

  // 1b. Breathing / relaxation
  if (has(q, ['breathe', 'breathing', 'relax', 'calm down', 'anxious', 'panic', 'साँस', 'सांस', 'शांत', 'घबरा', 'श्वास', 'चिंता']) && !has(q, ['chest', 'छाती', "can't", 'नहीं ले'])) {
    return out(
      t(lang, { en: 'Let us breathe together slowly. Follow the circle on the screen.', hi: 'चलिए साथ में धीरे-धीरे साँस लेते हैं। स्क्रीन पर गोले को देखिए।', mr: 'चला एकत्र हळूहळू श्वास घेऊया. स्क्रीनवरील गोल पाहा.' }),
      [{ type: 'BREATHE' }, { type: 'MOOD', mood: 'okay' }]
    )
  }

  // 1c. Remember something / recall a note (the elder's own words, stored on their device)
  if (/\b(remember that|remember this|note that|note down|save this|keep in mind)\b/.test(q) || has(q, ['याद रखना', 'याद रखो', 'याद रख ', 'नोट कर', 'लक्षात ठेव', 'नोंद कर'])) {
    const note = message
      .replace(/^(please\s+)?(remember( that| this)?|note( down| that)?|save this|keep in mind)[:,\s]*/i, '')
      .replace(/(याद रखना|याद रखो|नोट कर लो|नोट करो|लक्षात ठेवा|लक्षात ठेव|नोंद करा)[:,\s]*/g, '')
      .trim()
    if (note.length > 2) {
      return out(
        t(lang, { en: `Got it. I will remember: ${note}`, hi: `ठीक है, मैं याद रखूँगा: ${note}`, mr: `ठीक आहे, मी लक्षात ठेवीन: ${note}` }),
        [{ type: 'REMEMBER', text: note }]
      )
    }
  }
  if (has(q, ['where did i', 'where are my', 'where is my', 'what did i tell', 'what do you remember', 'कहाँ रखा', 'कहाँ रखी', 'कहां रखा', 'मैंने क्या कहा', 'कुठे ठेवले', 'कुठे ठेवली', 'काय सांगितले'])) {
    const words = q.split(/\s+/).filter((w) => w.length > 3)
    const scored = ctx.notes
      .map((n) => ({ n, score: words.filter((w) => n.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score)
    const best = scored[0]
    return out(
      best && best.score > 0
        ? t(lang, { en: `You told me: ${best.n}`, hi: `आपने मुझे बताया था: ${best.n}`, mr: `तुम्ही मला सांगितले होते: ${best.n}` })
        : t(lang, { en: 'I do not have a note about that yet. Say "remember that" followed by what you want me to keep.', hi: 'इस बारे में मेरे पास कोई नोट नहीं है। "याद रखना" कहकर बताइए।', mr: 'याबद्दल माझ्याकडे नोंद नाही. "लक्षात ठेव" म्हणून सांगा.' })
    )
  }

  // 2. Mark medicine / task done
  if (has(q, ['i took', 'taken my', 'took my', 'have taken', 'already took', 'ले ली', 'खा ली', 'घेतली', 'घेतले', 'लिया है'])) {
    const pending = ctx.reminders.filter((r) => !r.doneToday && r.kind === 'medicine').sort((a, b) => a.time.localeCompare(b.time))
    const target =
      ctx.reminders.find((r) => !r.doneToday && q.includes(r.title.toLowerCase().split(' ')[0])) || pending[0]
    if (target) {
      return out(
        t(lang, {
          en: `Wonderful! I have marked "${target.title}" as taken.`,
          hi: `बहुत बढ़िया! मैंने "${target.title}" ली हुई दर्ज कर दी है।`,
          mr: `छान! मी "${target.title}" घेतले अशी नोंद केली आहे.`,
        }),
        [{ type: 'MARK_DONE', title: target.title }]
      )
    }
  }

  // 3. Add reminder
  if (has(q, ['remind', 'reminder', 'याद दिला', 'रिमाइंडर', 'आठवण'])) {
    const time = parseTime(q)
    if (time) {
      const title = reminderTitle(message)
      return out(
        t(lang, {
          en: `Done. I will remind you: ${title} at ${fmt12(time)}.`,
          hi: `ठीक है। मैं ${fmt12(time)} पर आपको याद दिलाऊँगा: ${title}।`,
          mr: `ठीक आहे. मी ${fmt12(time)} वाजता तुम्हाला आठवण करून देईन: ${title}.`,
        }),
        [{ type: 'ADD_REMINDER', title, time, kind: kindOf(q) }, nav('Dashboard')]
      )
    }
    return out(
      t(lang, {
        en: 'Sure. What time should I remind you? For example, say "remind me to take my tablet at 6 PM".',
        hi: 'ज़रूर। किस समय याद दिलाऊँ? जैसे कहिए "शाम 6 बजे गोली याद दिलाओ"।',
        mr: 'नक्की. किती वाजता आठवण करू? उदा. "संध्याकाळी 6 वाजता गोळीची आठवण करा".',
      })
    )
  }

  // 4. Log a reading
  const bp = q.match(/(\d{2,3})\s*(?:\/|by|over|upon|पर|वर)\s*(\d{2,3})/)
  if (bp && has(q, ['bp', 'pressure', 'बीपी', 'ब्लड', 'रक्तदाब', 'प्रेशर', 'is', 'है', 'आहे'])) {
    const value = `${bp[1]}/${bp[2]}`
    const high = Number(bp[1]) >= 160 || Number(bp[2]) >= 100
    return out(
      high
        ? t(lang, {
            en: `I saved ${value}. That is on the higher side, so please sit and rest. I will let your family know.`,
            hi: `मैंने ${value} दर्ज किया। यह थोड़ा ज़्यादा है, कृपया आराम करें। मैं परिवार को बता रहा हूँ।`,
            mr: `मी ${value} नोंदवले. हे थोडे जास्त आहे, कृपया आराम करा. मी कुटुंबाला कळवतो.`,
          })
        : t(lang, {
            en: `Thank you. I saved your blood pressure as ${value}.`,
            hi: `धन्यवाद। मैंने आपका ब्लड प्रेशर ${value} दर्ज कर लिया है।`,
            mr: `धन्यवाद. मी तुमचा रक्तदाब ${value} नोंदवला आहे.`,
          }),
      [{ type: 'LOG_READING', kind: 'bp' as ReadingKind, value }]
    )
  }
  const sugar = q.match(/(?:sugar|शुगर|साखर)\D{0,12}(\d{2,3})/)
  if (sugar) {
    return out(
      t(lang, {
        en: `I saved your blood sugar as ${sugar[1]}.`,
        hi: `मैंने आपकी शुगर ${sugar[1]} दर्ज की।`,
        mr: `मी तुमची साखर ${sugar[1]} नोंदवली.`,
      }),
      [{ type: 'LOG_READING', kind: 'sugar', value: sugar[1] }]
    )
  }

  // 5. Medicine schedule
  if (has(q, ['medicine', 'pill', 'tablet', 'medication', 'दवाई', 'दवा', 'गोली', 'औषध', 'गोळी'])) {
    const pending = ctx.reminders.filter((r) => r.kind === 'medicine' && !r.doneToday).sort((a, b) => a.time.localeCompare(b.time))
    const reply = pending.length
      ? t(lang, {
          en: `Your next medicine is ${pending[0].title} at ${fmt12(pending[0].time)}.${pending.length > 1 ? ` ${pending.length - 1} more later today.` : ''}`,
          hi: `आपकी अगली दवा ${pending[0].title} है, ${fmt12(pending[0].time)} पर।`,
          mr: `तुमचे पुढचे औषध ${pending[0].title} आहे, ${fmt12(pending[0].time)} वाजता.`,
        })
      : t(lang, {
          en: 'You have taken all of today’s medicines. Well done!',
          hi: 'आज की सभी दवाइयाँ आप ले चुके हैं। शाबाश!',
          mr: 'आजची सर्व औषधे तुम्ही घेतली आहेत. शाबास!',
        })
    return out(reply, [nav('Healthcare')])
  }

  // 6. Call / message family
  if (/\b(call|phone|ring|dial|daughter|son|beti|beta)\b/.test(q) || has(q, ['फोन', 'कॉल', 'बात कराओ', 'बोलायचे', 'बेटी', 'बेटा', 'मुलगी', 'मुलगा']) || ctx.contacts.some((c) => q.includes(c.name.toLowerCase().split(' ')[0]))) {
    const wantsMsg = has(q, ['message', 'tell', 'inform', 'संदेश', 'बता', 'सांग', 'कळव'])
    const contact =
      ctx.contacts.find((c) => q.includes(c.name.toLowerCase().split(' ')[0])) ||
      ctx.contacts.find((c) => has(q, c.relation.toLowerCase() === 'daughter' ? ['daughter', 'beti', 'बेटी', 'मुलगी'] : c.relation.toLowerCase() === 'son' ? [' son', 'beta', 'बेटा', 'मुलगा'] : ['zzz'])) ||
      ctx.contacts[0]
    if (contact) {
      if (wantsMsg) {
        const text = `${ctx.name} says: ${message}`
        return out(
          t(lang, { en: `I am sending your message to ${contact.name}.`, hi: `मैं ${contact.name} को आपका संदेश भेज रहा हूँ।`, mr: `मी ${contact.name} यांना तुमचा संदेश पाठवत आहे.` }),
          [{ type: 'MESSAGE_FAMILY', to: contact.name, text }]
        )
      }
      return out(
        t(lang, { en: `Calling ${contact.name} now.`, hi: `${contact.name} को फोन लगा रहा हूँ।`, mr: `${contact.name} यांना फोन लावत आहे.` }),
        [{ type: 'CALL_CONTACT', name: contact.name }]
      )
    }
  }

  // 7. Weather (live)
  if (has(q, ['weather', 'rain', 'temperature', 'मौसम', 'बारिश', 'हवामान', 'पाऊस', 'तापमान'])) {
    try {
      const w = await getWeather(ctx.city)
      return out(w)
    } catch {
      return out(t(lang, { en: 'I could not reach the weather service right now. Please try again soon.', hi: 'अभी मौसम की जानकारी नहीं मिल पाई। कृपया थोड़ी देर बाद पूछें।', mr: 'सध्या हवामानाची माहिती मिळू शकली नाही. थोड्या वेळाने विचारा.' }))
    }
  }

  // 8. News (live)
  if (has(q, ['news', 'headline', 'समाचार', 'खबर', 'बातम्या', 'ख़बर'])) {
    try {
      const n = await getNews(lang)
      return out(n)
    } catch {
      return out(t(lang, { en: 'I could not fetch the news just now.', hi: 'अभी समाचार नहीं मिल पाए।', mr: 'आत्ता बातम्या मिळू शकल्या नाहीत.' }))
    }
  }

  // 9a. Stop music
  if (/\bstop (the )?(music|song|bhajan)\b/.test(q) || has(q, ['गाना बंद', 'संगीत बंद', 'भजन बंद', 'गाणे बंद', 'गाणं बंद'])) {
    return out(t(lang, { en: 'Okay, the music is off.', hi: 'ठीक है, संगीत बंद कर दिया।', mr: 'ठीक आहे, संगीत बंद केले.' }), [{ type: 'STOP_MUSIC' }])
  }

  // 9. Music / bhajans
  if (has(q, ['music', 'song', 'bhajan', 'gana', 'गाना', 'भजन', 'संगीत', 'गाणे', 'गाणं']) || /\bplay\b/.test(q)) {
    const query = has(q, ['bhajan', 'भजन']) ? 'bhajan' : has(q, ['old', 'पुराने', 'जुने']) ? 'old hindi songs' : 'relaxing indian classical music'
    return out(
      t(lang, { en: 'Here is some soothing music. Tap the button to play.', hi: 'यह रहा सुकून भरा संगीत। चलाने के लिए बटन दबाइए।', mr: 'हे घ्या शांत संगीत. सुरू करण्यासाठी बटण दाबा.' }),
      [{ type: 'PLAY_MUSIC', query }]
    )
  }

  // 10. Check-in
  if (has(q, ["i am fine", "i'm fine", 'i am okay', "i'm okay", 'i am good', 'feeling good', 'मैं ठीक', 'ठीक हूँ', 'ठीक हूं', 'मी ठीक', 'बरा आहे', 'मजेत'])) {
    return out(
      t(lang, { en: 'I am so glad to hear that. I have noted your check-in and told your family.', hi: 'यह सुनकर बहुत अच्छा लगा। आपका चेक-इन दर्ज कर परिवार को बता दिया है।', mr: 'हे ऐकून आनंद झाला. तुमचा चेक-इन नोंदवून कुटुंबाला कळवला आहे.' }),
      [{ type: 'CHECK_IN' }, { type: 'MOOD', mood: 'good' }]
    )
  }

  // 11. Pages
  if (has(q, ['report', 'progress', 'रिपोर्ट', 'अहवाल'])) return out(t(lang, { en: 'Opening your wellbeing report.', hi: 'आपकी रिपोर्ट खोल रहा हूँ।', mr: 'तुमचा अहवाल उघडत आहे.' }), [nav('Reports')])
  if (has(q, ['schedule', 'routine', 'my day', 'my plan', 'दिनक्रम', 'रूटीन', 'वेळापत्रक']))
    return out(
      t(lang, {
        en: `You have ${ctx.reminders.filter((r) => !r.doneToday).length} task(s) left today. Opening your schedule.`,
        hi: `आज ${ctx.reminders.filter((r) => !r.doneToday).length} काम बाकी हैं। आपका दिनक्रम खोल रहा हूँ।`,
        mr: `आज ${ctx.reminders.filter((r) => !r.doneToday).length} कामे बाकी आहेत. तुमचा दिनक्रम उघडत आहे.`,
      }),
      [nav('Dashboard')]
    )
  if (has(q, ['doctor', 'appointment', 'डॉक्टर', 'अपॉइंटमेंट', 'भेट'])) {
    const a = ctx.appointments[0]
    return out(
      a
        ? t(lang, { en: `Your next appointment is with ${a.doctor} on ${a.date} at ${fmt12(a.time)}.`, hi: `आपकी अगली अपॉइंटमेंट ${a.doctor} के साथ ${a.date} को ${fmt12(a.time)} पर है।`, mr: `तुमची पुढची भेट ${a.doctor} यांच्यासोबत ${a.date} रोजी ${fmt12(a.time)} वाजता आहे.` })
        : t(lang, { en: 'You have no upcoming appointments. You can add one in Healthcare.', hi: 'कोई अपॉइंटमेंट नहीं है। आप हेल्थकेयर में जोड़ सकते हैं।', mr: 'कोणतीही भेट ठरलेली नाही. तुम्ही हेल्थकेअरमध्ये जोडू शकता.' }),
      [nav('Healthcare')]
    )
  }
  if (has(q, ['bigger text', 'larger text', 'large text', 'big font', 'बड़ा फॉन्ट', 'अक्षर बड़े', 'फॉन्ट मोठा', 'अक्षरे मोठी']))
    return out(t(lang, { en: 'I have made the text larger.', hi: 'मैंने अक्षर बड़े कर दिए हैं।', mr: 'मी अक्षरे मोठी केली आहेत.' }), [{ type: 'SET_FONT', size: 'Large' }])

  // 12. Feelings
  if (has(q, ['lonely', 'alone', 'sad', 'bored', 'अकेला', 'उदास', 'बोर', 'एकटे', 'एकटेपणा', 'कंटाळा']))
    return out(
      t(lang, {
        en: `You are not alone, ${name}. I am right here. Would you like a song, a chat, or a call with family?`,
        hi: `आप अकेले नहीं हैं, ${name} जी। मैं यहीं हूँ। गाना सुनेंगे, बातें करेंगे, या परिवार को फोन लगाऊँ?`,
        mr: `तुम्ही एकटे नाही आहात, ${name}. मी इथेच आहे. गाणे ऐकायचे, गप्पा मारायच्या की कुटुंबाला फोन लावू?`,
      }),
      [{ type: 'MOOD', mood: 'low' }],
      t(lang, { en: 'Play a bhajan|Call my daughter|Tell me the news', hi: 'भजन सुनाओ|बेटी को फोन करो|समाचार सुनाओ', mr: 'भजन लावा|मुलीला फोन करा|बातम्या सांगा' }).split('|')
    )
  if (has(q, ['pain', 'dizzy', 'weak', 'tired', 'fever', 'headache', 'knee', 'दर्द', 'चक्कर', 'कमजोरी', 'थकान', 'बुखार', 'घुटने', 'दुखत', 'चक्कर', 'ताप', 'गुडघे', 'थकवा']))
    return out(
      t(lang, {
        en: 'I am sorry you feel unwell. Please sit down, sip some water and rest. I cannot diagnose, so if it does not ease soon, shall I call your family or doctor?',
        hi: 'आपकी तबीयत ठीक नहीं, यह सुनकर दुख हुआ। आराम से बैठिए, थोड़ा पानी पीजिए। मैं निदान नहीं कर सकता, अगर आराम न मिले तो परिवार या डॉक्टर को फोन करूँ?',
        mr: 'तुम्हाला बरे वाटत नाही याचे वाईट वाटते. शांत बसा, थोडे पाणी प्या. मी निदान करू शकत नाही, आराम न पडल्यास कुटुंबाला किंवा डॉक्टरांना फोन करू का?',
      }),
      [],
      t(lang, { en: 'Call my daughter|Call the doctor|I feel better', hi: 'बेटी को फोन करो|डॉक्टर को बुलाओ|अब ठीक हूँ', mr: 'मुलीला फोन करा|डॉक्टरांना बोलवा|आता बरे वाटते' }).split('|')
    )

  // 13. Greeting / thanks
  if (/\b(hello|hi|hey|namaste|good (morning|evening|afternoon))\b/.test(q) || has(q, ['नमस्ते', 'नमस्कार', 'प्रणाम']))
    return out(
      t(lang, {
        en: `Namaste ${name}! It is ${ctx.nowLocal.split(',').pop()?.trim()}. How are you feeling today?`,
        hi: `नमस्ते ${name} जी! आज आप कैसा महसूस कर रहे हैं?`,
        mr: `नमस्कार ${name}! आज तुम्हाला कसे वाटत आहे?`,
      })
    )
  if (has(q, ['thank', 'धन्यवाद', 'शुक्रिया', 'आभार']))
    return out(t(lang, { en: 'It is my pleasure. I am always here for you.', hi: 'यह मेरा सौभाग्य है। मैं हमेशा आपके साथ हूँ।', mr: 'हे माझे भाग्य. मी नेहमी तुमच्यासोबत आहे.' }))

  // 14. Default: varied, helpful, never the same line
  const nextMed = ctx.reminders.filter((r) => !r.doneToday).sort((a, b) => a.time.localeCompare(b.time))[0]
  const defaults: L3[] = [
    {
      en: 'I am not sure I understood that. You can ask me to call family, remind you of something, read the weather or news, or play a bhajan.',
      hi: 'मैं ठीक से समझ नहीं पाया। आप कह सकते हैं: परिवार को फोन करो, कुछ याद दिलाओ, मौसम या समाचार बताओ, या भजन चलाओ।',
      mr: 'मला नीट समजले नाही. तुम्ही म्हणू शकता: कुटुंबाला फोन करा, आठवण करा, हवामान किंवा बातम्या सांगा, किंवा भजन लावा.',
    },
    {
      en: `Could you say that once more, ${name}? I can help with calls, reminders, medicines, weather and news.`,
      hi: `${name} जी, क्या आप एक बार फिर कह सकते हैं? मैं फोन, याद दिलाने, दवा, मौसम और समाचार में मदद कर सकता हूँ।`,
      mr: `${name}, कृपया पुन्हा सांगाल का? मी फोन, आठवण, औषध, हवामान आणि बातम्यांमध्ये मदत करू शकतो.`,
    },
  ]
  const d = vary(defaults, q)
  return out(nextMed ? `${t(lang, d)} ${t(lang, { en: `By the way, ${nextMed.title} is at ${fmt12(nextMed.time)}.`, hi: `वैसे, ${nextMed.title} ${fmt12(nextMed.time)} पर है।`, mr: `तसे, ${nextMed.title} ${fmt12(nextMed.time)} वाजता आहे.` })}` : t(lang, d))
}

export function defaultSuggestions(lang: Lang): string[] {
  return {
    en: ['What are my medicines today?', 'Call my daughter', 'What is the weather?', 'Play a bhajan'],
    hi: ['आज की मेरी दवाइयाँ?', 'बेटी को फोन करो', 'आज का मौसम?', 'भजन सुनाओ'],
    mr: ['आजची माझी औषधे?', 'मुलीला फोन करा', 'आजचे हवामान?', 'भजन लावा'],
  }[lang]
}
