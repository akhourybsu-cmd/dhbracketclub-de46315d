import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

// Staggered list entrance — a parent that cascades its <StaggerItem> children
// in on mount. Shared so every list uses the same cadence/spring.

const CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};
const CONTAINER_REDUCED: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0 } },
};

const ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 480, damping: 34, mass: 0.7 } },
};
const ITEM_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? CONTAINER_REDUCED : CONTAINER} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? ITEM_REDUCED : ITEM} className={className}>
      {children}
    </motion.div>
  );
}
