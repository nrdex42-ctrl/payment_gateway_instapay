'use client'

import { useEffect, useState } from 'react'
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  Locale,
  arDictionary,
  getInitialLocale,
  localeLabels,
  persistLocale,
} from '@/lib/i18n-runtime'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT'])
const ORIGINAL_TEXT = 'data-i18n-original-text'
const ORIGINAL_ATTR_PREFIX = 'data-i18n-original-'

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function translateText(value: string, locale: Locale) {
  if (locale === 'en') return value
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  const normalized = normalizeText(value)
  const translated = arDictionary[normalized]
  return translated ? `${leading}${translated}${trailing}` : value
}

function shouldSkipElement(element: Element | null) {
  if (!element) return false
  if (SKIP_TAGS.has(element.tagName)) return true
  return Boolean(element.closest('[data-i18n-skip], pre, code, script, style, textarea, select'))
}

function translateAttribute(element: Element, attr: string, locale: Locale) {
  const originalAttr = `${ORIGINAL_ATTR_PREFIX}${attr}`
  const current = element.getAttribute(attr)
  if (!current) return
  if (!element.hasAttribute(originalAttr)) {
    element.setAttribute(originalAttr, current)
  }
  const original = element.getAttribute(originalAttr) || current
  element.setAttribute(attr, translateText(original, locale))
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  document.body.classList.toggle('locale-ar', locale === 'ar')
  document.body.classList.toggle('locale-en', locale === 'en')

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT
      if (!normalizeText(node.textContent || '')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  textNodes.forEach((node) => {
    const parent = node.parentElement
    if (!parent) return
    if (!parent.hasAttribute(ORIGINAL_TEXT)) {
      parent.setAttribute(ORIGINAL_TEXT, node.textContent || '')
    }
    const original = parent.getAttribute(ORIGINAL_TEXT) || node.textContent || ''
    node.textContent = translateText(original, locale)
  })

  document.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
    if (shouldSkipElement(element)) return
    ;['placeholder', 'aria-label', 'title'].forEach((attr) => translateAttribute(element, attr, locale))
  })
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const initial = getInitialLocale()
    setLocale(initial)
    applyLocale(initial)

    const observer = new MutationObserver(() => {
      applyLocale(getInitialLocale())
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  const toggleLocale = () => {
    const nextLocale: Locale = locale === 'ar' ? 'en' : 'ar'
    persistLocale(nextLocale)
    setLocale(nextLocale)
    applyLocale(nextLocale)
  }

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="fixed bottom-4 end-4 z-[1000] inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/90 px-3 py-2 text-xs font-bold text-white shadow-2xl shadow-black/30 backdrop-blur transition hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      aria-label={locale === 'ar' ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
      data-i18n-skip
    >
      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-950">
        {locale === 'ar' ? 'AR' : 'EN'}
      </span>
      <span>{locale === 'ar' ? localeLabels.en : localeLabels.ar}</span>
    </button>
  )
}
