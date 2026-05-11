import { Home, Package, BarChart3, Settings, ShoppingCart } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const navItems = [
  { to: '/', icon: Home, label: 'Beranda' },
  { to: '/products', icon: Package, label: 'Produk' },
  { to: '/cashier', icon: ShoppingCart, label: 'Kasir', isCta: true },
  { to: '/reports', icon: BarChart3, label: 'Laporan' },
  { to: '/settings', icon: Settings, label: 'Lainnya' },
];

export default function BottomNav() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const keyboardThreshold = 120;

    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    const setKeyboardClass = (open: boolean) => {
      document.documentElement.classList.toggle('keyboard-open', open);
      document.body.classList.toggle('keyboard-open', open);
    };

    const updateKeyboardState = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const heightDiff = window.innerHeight - viewportHeight;
      const isOpen = heightDiff > keyboardThreshold;

      setKeyboardOpen(isOpen);
      setKeyboardClass(isOpen);
      if (!isOpen) setAppHeight();
    };

    const isTextInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isTextInput(event.target)) {
        setKeyboardOpen(true);
        setKeyboardClass(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!isTextInput(active)) {
          setKeyboardOpen(false);
          setKeyboardClass(false);
          setAppHeight();
        }
      }, 0);
    };

    setAppHeight();
    updateKeyboardState();
    viewport?.addEventListener('resize', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      setKeyboardClass(false);
    };
  }, []);

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] transition-transform duration-150',
      keyboardOpen && 'translate-y-full'
    )}>
      <div className="flex items-end justify-around h-16 max-w-lg md:max-w-6xl mx-auto px-2 md:px-4">
        {navItems.map(({ to, icon: Icon, label, isCta }) => (
          <NavLink
            key={to}
            to={to}
            replace
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 transition-colors min-w-[52px]',
                isCta
                  ? 'relative -top-4'
                  : cn(
                      'px-2 py-1.5 rounded-xl',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )
              )
            }
          >
            {({ isActive }) =>
              isCta ? (
                <>
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95',
                    'bg-primary text-primary-foreground',
                    isActive && 'ring-4 ring-primary/20'
                  )}>
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold leading-tight mt-0.5',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}>{label}</span>
                </>
              ) : (
                <>
                  <div className={cn(
                    'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                    isActive && 'bg-primary/10'
                  )}>
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="text-[10px] font-semibold leading-tight">{label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
