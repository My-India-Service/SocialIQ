import { useEffect, useRef } from 'react';

/** 6-digit OTP input with mobile-friendly numeric keyboard. */
export default function OtpInput({ value, onChange, disabled = false, autoFocus = true }) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
    .padEnd(6, ' ')
    .split('')
    .map((c) => (c === ' ' ? '' : c));
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setDigit(index, char) {
    const next = [...digits];
    next[index] = char;
    onChange(next.join('').replace(/\s/g, ''));
  }

  function onKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setDigit(index - 1, '');
      e.preventDefault();
    }
  }

  function onPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted);
  }

  return (
    <div className="otp-input" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="otp-input-cell"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, '').slice(-1);
            setDigit(i, char);
            if (char && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
        />
      ))}
    </div>
  );
}
