import { Injectable } from '@angular/core';
import {environment} from "../environments/environment";
import {SquareEnv} from "./shared/square-env.type";

@Injectable({ providedIn: 'root' })
export class SquarePaymentService {
  private payments: any;
  private card: any;
  private scriptLoading?: Promise<void>;

  private loadScript(src: string): Promise<void> {
    if ((window as any).Square) return Promise.resolve();
    if (this.scriptLoading) return this.scriptLoading;

    this.scriptLoading = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.type = 'text/javascript';
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load Square Web Payments SDK: ${src}`));
      document.head.appendChild(el);
    });

    return this.scriptLoading;
  }

  async init(applicationId: string, locationId: string, env : SquareEnv = environment.squareEnv) {
    const src =
      env === 'sandbox'
        ? 'https://sandbox.web.squarecdn.com/v1/square.js'
        : 'https://web.squarecdn.com/v1/square.js';

    await this.loadScript(src);

    const Square = (window as any).Square;
    if (!Square?.payments) throw new Error('Square.payments is unavailable');

    this.payments = await Square.payments(applicationId, locationId);
    return this.payments;
  }

  async createCard(containerSelector: string) {
    if (!this.payments) throw new Error('Payments SDK not initialized');

    if (this.card?.destroy) {
      try { this.card.destroy(); } catch {}
    }

    this.card = await this.payments.card();
    await this.card.attach(containerSelector);
    return this.card;
  }

}
