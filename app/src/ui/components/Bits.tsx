import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Btn({ variant = '', sm, block, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | ''; sm?: boolean; block?: boolean }) {
  return (
    <button className={`btn edge cutA ${variant} ${sm ? 'sm' : ''} ${block ? 'block' : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Slab({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`slab edge cutB ${className}`} style={style}>
      {children}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch edge cutA ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={`edge cutA ${o.v === value ? 'on' : ''}`} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, step, min, max, fmt }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; fmt?: (n: number) => string }) {
  return (
    <div className="num-in">
      <button className="edge cutA" aria-label="weniger" onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <span>{fmt ? fmt(value) : value}</span>
      <button className="edge cutA" aria-label="mehr" onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  )
}
