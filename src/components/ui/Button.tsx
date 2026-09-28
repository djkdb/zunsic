import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'buy' | 'sell' | 'ghost' | 'outline' | 'amber' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-ink)] text-[var(--color-bg)] hover:bg-white',
  buy: 'bg-[var(--color-up)] text-[#04140b] hover:brightness-110',
  sell: 'bg-[var(--color-down)] text-[#1a0505] hover:brightness-110',
  ghost: 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-panel-2)]',
  outline: 'border border-[var(--color-line-strong)] text-[var(--color-ink)] hover:bg-[var(--color-panel-2)]',
  amber: 'bg-[var(--color-amber)] text-[#1b1203] hover:brightness-110',
  danger: 'border border-[var(--color-down)]/60 text-[var(--color-down)] hover:bg-[var(--color-down-soft)]',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-3 text-sm sm:px-6',
};

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-mono font-semibold tracking-wide uppercase transition-[background,filter,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
