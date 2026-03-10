import { Link } from "react-router";
import { Home } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
          404
        </h1>
        <h2 className="text-2xl mb-4">Nie znaleziono strony</h2>
        <p className="text-gray-600 mb-8">
          Wygląda na to, że zabłądziłeś... tak jak my w lesie podczas medytacji 🌲
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:shadow-lg transition-shadow"
        >
          <Home size={20} />
          Wróć do domu
        </Link>
      </div>
    </div>
  );
}
