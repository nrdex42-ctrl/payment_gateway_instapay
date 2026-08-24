'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, ArrowRight, Loader2, Key } from 'lucide-react'
import { createCheckout, checkPaymentStatus } from './actions/payment'

const PRODUCTS = [
  { id: 'starter', name: 'Starter Tier', price: 1, color: 'from-blue-500 to-cyan-400', shadow: 'shadow-blue-500/20' },
  { id: 'basic', name: 'Basic Tier', price: 2, color: 'from-violet-500 to-purple-400', shadow: 'shadow-violet-500/20' },
  { id: 'standard', name: 'Standard Tier', price: 3, color: 'from-pink-500 to-rose-400', shadow: 'shadow-pink-500/20' },
  { id: 'premium', name: 'Premium Tier', price: 5, color: 'from-amber-500 to-orange-400', shadow: 'shadow-amber-500/20' },
]

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null)
  
  // Checkout states
  const [step, setStep] = useState<'selection' | 'handle' | 'waiting' | 'success'>('selection')
  const [handle, setHandle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutData, setCheckoutData] = useState<any>(null)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 'waiting' && checkoutData?.sessionId) {
      interval = setInterval(async () => {
        const res = await checkPaymentStatus(checkoutData.sessionId)
        if (res.success && res.checkout) {
          if (res.checkout.status === 'CONFIRMED') {
            setStep('success')
            clearInterval(interval)
          } else if (res.checkout.status === 'EXPIRED') {
            setError('Payment session expired. Please try again.')
            setStep('selection')
            clearInterval(interval)
          }
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [step, checkoutData])

  const handleBuyClick = (product: typeof PRODUCTS[0]) => {
    setSelectedProduct(product)
    setStep('handle')
    setError(null)
  }

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!handle.includes('@instapay')) {
      setError('Please enter a valid InstaPay handle (e.g. username@instapay)')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    const res = await createCheckout({
      amountEgp: selectedProduct!.price,
      senderHandle: handle,
      note: `Purchase: ${selectedProduct!.name}`
    })

    if (res.success) {
      setCheckoutData(res.checkout)
      setStep('waiting')
    } else {
      setError(res.error)
    }
    setSubmitting(false)
  }

  const reset = () => {
    setStep('selection')
    setSelectedProduct(null)
    setHandle('')
    setCheckoutData(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-violet-500/30 pb-20">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/20 blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-20 flex flex-col items-center">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Premium Digital Services</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Elevate your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
              digital workflow
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Get instant access to premium features and capabilities. 
            Checkout securely via InstaPay in seconds.
          </p>
        </motion.div>

        {/* Dynamic Content Area */}
        <AnimatePresence mode="wait">
          {step === 'selection' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full"
            >
              {PRODUCTS.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`relative p-8 rounded-3xl bg-white/5 border border-white/10 shadow-2xl ${p.shadow} backdrop-blur-md flex flex-col gap-6 overflow-hidden group`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${p.color} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity`} />
                  
                  <div>
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                        {p.price}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">EGP</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 flex-1">
                    {[1, 2, 3].map((_, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 className={`w-4 h-4 text-white/50`} />
                        Premium feature {idx + 1}
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handleBuyClick(p)}
                    className={`w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r ${p.color} text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group-hover:gap-3 z-10 relative`}
                  >
                    Select Plan
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}

          {step === 'handle' && selectedProduct && (
            <motion.div
              key="handle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl"
            >
              <div className="mb-8">
                <button onClick={reset} className="text-sm text-slate-400 hover:text-white transition-colors mb-4 block">
                  &larr; Back to plans
                </button>
                <h2 className="text-2xl font-bold">Checkout</h2>
                <p className="text-slate-400 mt-2">You selected the <strong className="text-white">{selectedProduct.name}</strong> for {selectedProduct.price} EGP.</p>
              </div>

              <form onSubmit={handleStartCheckout} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Your InstaPay Handle
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="username@instapay"
                      value={handle}
                      onChange={e => setHandle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                    <Key className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    'Generate Payment Request'
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'waiting' && checkoutData && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl text-slate-900 text-center"
            >
              <h2 className="text-2xl font-bold mb-2">Awaiting Payment</h2>
              <div className="mb-8 space-y-3">
                <p className="text-slate-500">Scan this code using the InstaPay app or tap the button below if you are on your phone.</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-800 border border-slate-100">
                  <span>{selectedProduct?.name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-violet-600">{checkoutData.amountEgp} EGP</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm inline-block mb-8">
                <img 
                  src={checkoutData.qrCodeDataUrl} 
                  alt="InstaPay QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <a 
                href={checkoutData.deepLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                Open InstaPay App
              </a>

              <div className="flex justify-center items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                Listening for confirmation...
              </div>
              
              <button onClick={reset} className="mt-6 text-sm text-slate-400 hover:text-slate-600 underline border-none bg-transparent">
                Cancel Checkout
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-10 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-2xl shadow-emerald-500/20 text-white text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <h2 className="text-3xl font-black mb-3">Payment Confirmed!</h2>
              <p className="text-emerald-50 mb-8">
                Thank you for purchasing the {selectedProduct?.name}. Your account has been upgraded successfully.
              </p>
              <button
                onClick={reset}
                className="px-8 py-3 rounded-xl font-bold bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg transition-colors border-none"
              >
                Go to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
