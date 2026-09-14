export function getUnifiedStatusBadgeClass(status: string | null | undefined): string {
  const normalized = (status || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!normalized) {
    return 'ui-status-badge--neutral';
  }

  switch (normalized) {
    case 'created':
    case 'draft':
      return 'ui-status-badge--created';
    case 'received':
      return 'ui-status-badge--received';
    case 'pending':
    case 'unpaid':
    case 'awaitingpayment':
    case 'paymentpending':
    case 'pendingrescheduledforfollowup':
    case 'inprogress':
    case 'refillrequested':
      return 'ui-status-badge--pending';
    case 'completed':
    case 'complete':
    case 'paid':
    case 'succeeded':
    case 'successful':
    case 'settled':
    case 'captured':
    case 'delivered':
    case 'ordered':
    case 'fulfilled':
    case 'notrequired':
      return 'ui-status-badge--success';
    case 'fullyrefunded':
    case 'partiallyrefunded':
    case 'partialrefund':
    case 'refundissued':
    case 'refunded':
    case 'shipped':
    case 'outfordelivery':
    case 'senttopharmacy':
    case 'uploaded':
    case 'inreview':
    case 'processing':
    case 'active':
      return 'ui-status-badge--info';
    case 'paused':
    case 'onhold':
      return 'ui-status-badge--paused';
    case 'cancelled':
    case 'canceled':
    case 'inactive':
    case 'disabled':
    case 'rejected':
    case 'failed':
    case 'returned':
    case 'expired':
    case 'overdue':
    case 'pastdue':
      return 'ui-status-badge--danger';
    case 'archived':
      return 'ui-status-badge--archived';
    default:
      return 'ui-status-badge--neutral';
  }
}
