import { motion } from "motion/react";
import { ShoppingCart, Star, Sparkles } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: "clothing" | "accessories" | "books";
}

const products: Product[] = [
  {
    id: "cap",
    name: "Czapka z daszkiem ODJEBAO",
    description:
      "Wysokiej jakości czapka z haftowanym logo. Pokaż światu, że wiesz co jest ważne.",
    price: 89,
    image:
      "https://images.unsplash.com/photo-1767424694484-bcde4a6a2c55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzdHJlZXR3ZWFyJTIwaG9vZGllfGVufDF8fHx8MTc3MTg3MjQxNnww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "clothing",
  },
  {
    id: "hoodie",
    name: "Bluza ODJEBAO",
    description:
      "Wygodna bluza premium z charakterystycznym napisem. Idealna na spacery do lasu.",
    price: 199,
    image:
      "https://images.unsplash.com/photo-1767424694484-bcde4a6a2c55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzdHJlZXR3ZWFyJTIwaG9vZGllfGVufDF8fHx8MTc3MTg3MjQxNnww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "clothing",
  },
  {
    id: "bracelet",
    name: "Bransoletka ODJEBAO",
    description:
      "Minimalistyczna bransoletka z napisem. Subtelne przypomnienie o świadomym życiu.",
    price: 49,
    image:
      "https://images.unsplash.com/photo-1764889743612-9e3761d787f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5kZnVsbmVzcyUyMHBlYWNlZnVsJTIweW9nYXxlbnwxfHx8fDE3NzE4NzI0MTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "accessories",
  },
  {
    id: "wristband",
    name: "Opaska ODJEBAO",
    description:
      "Silikonowa opaska do noszenia na co dzień. Twoje motto zawsze przy Tobie.",
    price: 29,
    image:
      "https://images.unsplash.com/photo-1764889743612-9e3761d787f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5kZnVsbmVzcyUyMHBlYWNlZnVsJTIweW9nYXxlbnwxfHx8fDE3NzE4NzI0MTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "accessories",
  },
  {
    id: "book",
    name: "Książka: Przewodnik po świadomym życiu",
    description:
      "Kompendium wiedzy o medytacji, zdrowym odżywianiu i przebudzeniu. Wszystko, czego potrzebujesz.",
    price: 79,
    image:
      "https://images.unsplash.com/photo-1712873069353-87c44687d345?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZm9vZCUyMHZlZ2V0YWJsZXN8ZW58MXx8fHwxNzcxODcyNDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "books",
  },
  {
    id: "journal",
    name: "Dziennik świadomości",
    description:
      "Prowadź dziennik swojej podróży. Zapisuj przemyślenia, odkrycia i transformacje.",
    price: 59,
    image:
      "https://images.unsplash.com/photo-1712873069353-87c44687d345?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZm9vZCUyMHZlZ2V0YWJsZXN8ZW58MXx8fHwxNzcxODcyNDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "books",
  },
];

export function Shop() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const categories = [
    { id: "all", label: "Wszystko" },
    { id: "clothing", label: "Ubrania" },
    { id: "accessories", label: "Akcesoria" },
    { id: "books", label: "Książki" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-6 shadow-lg"
          >
            <Sparkles className="text-purple-600" size={20} />
            <span className="text-purple-600 font-semibold">
              Oficjalny merch
            </span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Pokaż znajomym,{" "}
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              że mają rację
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Wysokiej jakości produkty dla wszystkich, którym odjeba*o. Bo jeśli
            już idziesz swoją drogą, rób to w stylu! 😎
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                selectedCategory === category.id
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:shadow-md"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow group"
            >
              {/* Product Image */}
              <div className="relative h-64 overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {index < 2 && (
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Star size={14} fill="currentColor" />
                    Bestseller
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {product.price} zł
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2"
                  >
                    <ShoppingCart size={18} />
                    Kup
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 bg-white rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">
            Dlaczego warto?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="font-semibold mb-2">Wysoka jakość</h3>
              <p className="text-gray-600 text-sm">
                Produkty premium, które przetrwają Twoją transformację
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🌱</span>
              </div>
              <h3 className="font-semibold mb-2">Eko-friendly</h3>
              <p className="text-gray-600 text-sm">
                Ekologiczne materiały i produkcja zgodna z wartościami
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💜</span>
              </div>
              <h3 className="font-semibold mb-2">Wspierasz społeczność</h3>
              <p className="text-gray-600 text-sm">
                Część zysków przeznaczamy na rozwój społeczności
              </p>
            </div>
          </div>
        </motion.div>

        {/* Notice */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            💡 To jest strona demonstracyjna. Produkty i funkcja zakupowa są
            przykładowe.
          </p>
        </div>
      </div>
    </div>
  );
}