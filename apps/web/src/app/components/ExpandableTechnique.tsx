import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

interface ExpandableTechniqueProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  content: React.ReactNode;
  index: number;
  expanded: boolean;
  onExpand: () => void;
}

export function ExpandableTechnique({
  icon,
  title,
  description,
  content,
  index,
  expanded,
  onExpand,
}: ExpandableTechniqueProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: expanded ? 0 : index * 0.1 }}
      className={`bg-white rounded-2xl shadow-lg overflow-hidden ${
        expanded ? "col-span-full" : ""
      }`}
    >
      {/* Header - always visible */}
      <button
        onClick={onExpand}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
              {icon}
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="text-purple-600" size={24} />
          </motion.div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 border-t border-gray-100">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
