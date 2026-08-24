'use server'

interface CreateCheckoutArgs {
  amountEgp: number;
  senderHandle: string;
  note?: string;
}

export async function createCheckout(args: CreateCheckoutArgs) {
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000'
  const clientSlug = process.env.GATEWAY_MERCHANT_SLUG || 'mohammedshabana77'

  try {
    const res = await fetch(`${gatewayUrl}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientSlug,
        senderHandle: args.senderHandle,
        amountEgp: args.amountEgp,
        note: args.note || 'Premium Service Purchase'
      }),
      // Don't cache this request
      cache: 'no-store'
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create checkout'
      }
    }

    return {
      success: true,
      checkout: data.checkout
    }
  } catch (error: any) {
    console.error('Failed to connect to gateway:', error)
    return {
      success: false,
      error: 'Network error communicating with the payment gateway.'
    }
  }
}

export async function checkPaymentStatus(sessionId: string) {
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${gatewayUrl}/api/checkout/${sessionId}`, {
      cache: 'no-store'
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      return { success: false, error: data.error }
    }
    return { success: true, checkout: data.checkout }
  } catch (error: any) {
    return { success: false, error: 'Network error checking status.' }
  }
}
