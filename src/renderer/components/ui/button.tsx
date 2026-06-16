import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-float hover:brightness-105 active:brightness-95',
        destructive:
          'bg-destructive text-destructive-foreground shadow-float hover:brightness-105 active:brightness-95',
        outline:
          'border border-border/80 bg-elevated/40 text-foreground hover:border-spectral-1/30 hover:bg-elevated',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground'
      },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 px-2.5 text-xs', icon: 'h-9 w-9' }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
