import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface HeroRevealProps {
  children: ReactNode;
}

/**
 * Small framer-motion island used only for the hero's fade/slide-in reveal.
 * Everything inside is static markup passed in as slotted children from
 * index.astro — this component just animates it in once it enters view.
 */
export default function HeroReveal({ children }: HeroRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
