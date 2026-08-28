'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

  const toggleLocale = () => {
    const nextLocale: Locale = locale === 'ar' ? 'en' : 'ar'
    persistLocale(nextLocale)
    setLocale(nextLocale)
    applyLocale(nextLocale)
  }

  const button = (
    <button
      type="button"
      onClick={toggleLocale}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-2.5 text-[11px] font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:gap-2 sm:px-3 sm:text-xs"
      aria-label={locale === 'ar' ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
      data-i18n-skip
    >
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-950 sm:px-2 sm:text-[10px]">
        {locale === 'ar' ? 'AR' : 'EN'}
      </span>
      <span className="hidden sm:inline">{locale === 'ar' ? localeLabels.en : localeLabels.ar}</span>
      <span className="sm:hidden">{locale === 'ar' ? 'EN' : 'AR'}</span>
    </button>
  )

  if (target) return createPortal(button, target)

  return (
    <div className="fixed end-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] sm:end-4" data-i18n-skip>
      {button}
    </div>
  )
}
