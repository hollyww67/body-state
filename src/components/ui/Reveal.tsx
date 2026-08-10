"use client";

import { motion } from "framer-motion";

export default function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      // Keep content visible if motion/intersection updates are unavailable.
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay }}
    >
      {children}
    </motion.div>
  );
}
