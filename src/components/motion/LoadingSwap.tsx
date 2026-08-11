import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Crossfade between a loading skeleton and the loaded content so data never
 * "pops" in. Skeleton fades out, content fades (and lifts) in. Consistent
 * skeleton→content transition wherever a page swaps on a `loading` flag.
 */
export function LoadingSwap({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        <motion.div key="sk" exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="ct"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
