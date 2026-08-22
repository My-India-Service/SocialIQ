/** Resolve objective-based handoff URL for DM qualification completion. */

function normalizePhoneForWaMe(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildWhatsAppLink(phone, text = 'Hi, I saw your reel and want to order') {
  const normalized = normalizePhoneForWaMe(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function resolveHandoff(user, campaign, options = {}) {
  const objective = campaign?.objective || options.objective || 'sell';
  const customerHandle = options.customerHandle || '';

  const websiteUrl =
    campaign?.dmLink?.trim() ||
    user?.autoDm?.websiteUrl?.trim() ||
    user?.autoDm?.catalogueUrl?.trim() ||
    '';

  const bookingUrl = campaign?.bookingUrl?.trim() || user?.autoDm?.bookingUrl?.trim() || '';

  const whatsappPhone =
    campaign?.whatsappHandoffPhone?.trim() ||
    user?.autoDm?.whatsappHandoffPhone?.trim() ||
    user?.integrations?.whatsappNotifyPhone?.trim() ||
    '';

  const handoffMessage =
    campaign?.handoffMessage?.trim() ||
    'Great — here is the next step to complete your order:';

  if (objective === 'appointment' && bookingUrl) {
    return { type: 'booking', url: bookingUrl, message: handoffMessage };
  }

  if (objective === 'leads' && whatsappPhone) {
    const waUrl = buildWhatsAppLink(
      whatsappPhone,
      customerHandle ? `Hi, I'm ${customerHandle} — interested from your reel` : undefined
    );
    if (waUrl) return { type: 'whatsapp', url: waUrl, message: handoffMessage };
  }

  if (objective === 'link' && (campaign?.dmLink || user?.autoDm?.catalogueUrl)) {
    const url = campaign?.dmLink?.trim() || user?.autoDm?.catalogueUrl?.trim();
    return { type: 'website', url, message: handoffMessage };
  }

  if (websiteUrl) {
    return { type: 'website', url: websiteUrl, message: handoffMessage };
  }

  if (bookingUrl) {
    return { type: 'booking', url: bookingUrl, message: handoffMessage };
  }

  if (whatsappPhone) {
    const waUrl = buildWhatsAppLink(whatsappPhone);
    if (waUrl) return { type: 'whatsapp', url: waUrl, message: handoffMessage };
  }

  return { type: 'none', url: '', message: handoffMessage };
}

export function isQualificationComplete(qualification = {}) {
  const hasLocation = Boolean(qualification.city?.trim() || qualification.pincode?.trim());
  const hasCod = qualification.cod !== null && qualification.cod !== undefined;
  return hasCod && hasLocation;
}

export function missingQualificationFields(qualification = {}, questions = []) {
  const missing = [];
  if (qualification.cod === null || qualification.cod === undefined) missing.push('cod');
  if (!qualification.city?.trim()) missing.push('city');
  if (!qualification.pincode?.trim()) missing.push('pincode');
  if (!qualification.phone?.trim() && questions.some((q) => /phone|number/i.test(q))) {
    missing.push('phone');
  }
  return missing;
}
