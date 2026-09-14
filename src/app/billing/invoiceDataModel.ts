export interface InvoiceData {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string | null;
  amount: string;
  status: string;
  invoiceType: string;
  isActive: boolean;
  createdBy: number;
  createdDate: string;
  subscriptionId: number | null;
  expirationYear: string;
  expirationMonth: string;
  last4: string;
  cardBrand: string;
  cardHolderName: string;
  currency: string;
  cardId: number;
  email: string;
}
