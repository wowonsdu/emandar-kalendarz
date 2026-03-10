import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              odjebao.me
            </h3>
            <p className="text-gray-400">
              Społeczność ludzi, którym "odjeba*o" - w najlepszym tego słowa znaczeniu.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Przydatne linki</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="#" className="hover:text-purple-400 transition-colors">
                  O nas
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-purple-400 transition-colors">
                  Kontakt
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-purple-400 transition-colors">
                  Polityka prywatności
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Dołącz do nas</h4>
            <p className="text-gray-400 mb-4">
              Bądź na bieżąco z najnowszymi technikami świadomego życia.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
              >
                IG
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
              >
                FB
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
              >
                YT
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p className="flex items-center justify-center gap-2">
            Stworzone z <Heart size={16} className="text-pink-500" /> dla wszystkich, którym odjeba*o
          </p>
          <p className="mt-2 text-sm">© 2026 odjebao.me. Wszystkie prawa zastrzeżone.</p>
        </div>
      </div>
    </footer>
  );
}