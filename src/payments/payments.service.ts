import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    const lineItems = items.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));
    const session = await this.stripe.checkout.sessions.create({
      // colocar aquí el id de mi orden
      payment_intent_data: {
        metadata: { orderId },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.successUrl,
      cancel_url: envs.cancelUrl,
    });

    return session;
  }

  async handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    let event;
    // This is your Stripe CLI webhook secret for testing your endpoint locally.
    // const endpointSecret =
    //  'whsec_4438ecb2fa32c84f6ee835cefdadaf530f762f102c26253c8899e5802c047fb2';
    const endpointSecret = envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'charge.succeeded':
        // TODO: llamar a nuestro microservicio
        const chargeSucceded = event.data.object;
        console.log({
          metadata: chargeSucceded.metadata,
          orderId: chargeSucceded.metadata.orderId,
        });
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  }
}
