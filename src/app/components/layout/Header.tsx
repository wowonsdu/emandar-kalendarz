import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              odjebao.me
            </motion.div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Strona główna
            </Link>
            <a
              href="/#kalendarium"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Kalendarium
            </a>
            <Link
              to="/quiz"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Quiz
            </Link>
            <Link
              to="/cwiczenie-5-minut"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Pierwsze ćwiczenie! (5 minut)
            </Link>
            <Link
              to="/nasze-miejsca"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Nasze miejsca
            </Link>
            <Link
              to="/nasi-ludzie"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Nasi ludzie
            </Link>
            <Link
              to="/sklep"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Sklep
            </Link>
            <Link
              to="/spolecznosc"
              className="text-gray-700 hover:text-purple-600 transition-colors"
            >
              Społeczność
            </Link>
            <Link
              to="/wip"
              className="text-orange-600 hover:text-orange-700 transition-colors font-semibold"
            >
              WIP
            </Link>
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-200 bg-white"
          >
            <nav className="flex flex-col space-y-1 px-4 py-4">
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Strona główna
              </Link>
              <a
                href="/#kalendarium"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Kalendarium
              </a>
              <Link
                to="/quiz"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Quiz
              </Link>
              <Link
                to="/cwiczenie-5-minut"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Pierwsze ćwiczenie! (5 minut)
              </Link>
              <Link
                to="/nasze-miejsca"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Nasze miejsca
              </Link>
              <Link
                to="/nasi-ludzie"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Nasi ludzie
              </Link>
              <Link
                to="/sklep"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Sklep
              </Link>
              <Link
                to="/spolecznosc"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                Społeczność
              </Link>
              <Link
                to="/wip"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 rounded-lg text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-colors font-semibold"
              >
                WIP
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
