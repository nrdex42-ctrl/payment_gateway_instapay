'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'
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
const ORIGINAL_ATTR_PREFIX = 'data-i18n-original-'
const originalTextNodes = new WeakMap<Text, string>()
let isApplyingLocale = false

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
  if (isApplyingLocale) return
  isApplyingLocale = true
  try {
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
      if (!originalTextNodes.has(node)) {
        originalTextNodes.set(node, node.textContent || '')
      }
      const original = originalTextNodes.get(node) || node.textContent || ''
      node.textContent = translateText(original, locale)
    })

    document.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
      if (shouldSkipElement(element)) return
      ;['placeholder', 'aria-label', 'title'].forEach((attr) => translateAttribute(element, attr, locale))
    })
  } finally {
    isApplyingLocale = false
  }
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<Locale>('en')
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const initial = getInitialLocale()
    setLocale(initial)
    applyLocale(initial)
    setTarget(document.querySelector('[data-language-toggle-slot]'))

    const observer = new MutationObserver(() => {
      if (isApplyingLocale) return
      applyLocale(getInitialLocale())
      setTarget(document.querySelector('[data-language-toggle-slot]'))
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  const setExactLocale = (nextLocale: Locale) => {
    persistLocale(nextLocale)
    setLocale(nextLocale)
    applyLocale(nextLocale)
  }

  const switcher = (
    <div
      className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-inner"
      data-i18n-skip
    >
      <button
        type="button"
        onClick={() => setExactLocale('en')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
          locale === 'en'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Switch language to English"
        data-i18n-skip
      >
        <Globe className="h-3.5 w-3.5" />
        <span>English</span>
      </button>
      <button
        type="button"
        onClick={() => setExactLocale('ar')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
          locale === 'ar'
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="التحويل للغة العربية"
        data-i18n-skip
      >
        <span>العربية</span>
        <span className="text-[10px] opacity-80">🇪🇬</span>
      </button>
    </div>
  )

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/docs')) {
    return null
  }

  if (target) return createPortal(switcher, target)

  return null
}
