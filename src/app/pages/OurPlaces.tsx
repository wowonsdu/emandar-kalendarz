import { motion } from "motion/react";
import { MapPin, Star, Users, Wifi, Coffee, TreePine, Heart, ExternalLink } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface Place {
  id: string;
  name: string;
  owner: string;
  location: string;
  description: string;
  image: string;
  amenities: string[];
  capacity: string;
  rating?: number;
  website?: string;
  contact?: string;
  color: string;
}

const places: Place[] = [
  {
    id: "highland-business-hotel",
    name: "Highland Business Hotel",
    owner: "Zespół Highland",
    location: "Tatry, Zakopane",
    description: "Luksusowy hotel biznesowy w sercu Tatr, idealny na świadome retreaty, spotkania biznesowe 3.0 i warsztaty rozwoju osobistego. Połączenie nowoczesnego komfortu z bliskością natury.",
    image: "https://images.unsplash.com/photo-1746589339693-17737443d9bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzcxODg2MjI1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Sale konferencyjne", "Strefa relaksu", "WiFi", "Restauracja eco"],
    capacity: "30-50 osób",
    rating: 4.9,
    website: "https://highland-business-hotel.pl",
    contact: "kontakt@highland-business-hotel.pl",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "domki-nad-mucharskim",
    name: "Domki nad Mucharskim",
    owner: "Krystian",
    location: "Mucharz, Beskidy",
    description: "Kameralne drewniane domki w Beskidach, otoczone lasem i ciszą. Idealne miejsce na odłączenie się od zgiełku, medytację w naturze i uziemianie. Krystian tworzy przestrzeń dla prawdziwego wypoczynku ducha.",
    image: "https://images.unsplash.com/photo-1762158866005-dea9eae24c45?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY2FiaW4lMjB3b29kcyUyMHBvbGFuZHxlbnwxfHx8fDE3NzE4ODYyMjV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Kominek", "Taras widokowy", "Ścieżki spacerowe", "Brak WiFi (digital detox)"],
    capacity: "2-6 osób/domek",
    rating: 5.0,
    contact: "krystian@domki-mucharz.pl",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "gorski-azyl",
    name: "Górski Azyl",
    owner: "Ania",
    location: "Bieszczady",
    description: "Mała osada domków w Bieszczadach, prowadzona przez Anię - miłośniczkę energii gór. Przestrzeń idealna na wewnętrzną podróż, praktyki energetyczne i spotkania społeczności świadomych ludzi.",
    image: "https://images.unsplash.com/photo-1766852287368-01975b8ad3d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMHJldHJlYXQlMjBhY2NvbW1vZGF0aW9ufGVufDF8fHx8MTc3MTg4NjIyNnww&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Sala do jogi", "Miejsce na ognisko", "Organiczne śniadania", "Warsztaty czakr"],
    capacity: "10-15 osób",
    rating: 4.8,
    contact: "ania@gorski-azyl.pl",
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "eko-osada",
    name: "Eko Osada Las",
    owner: "Marcin i Kasia",
    location: "Puszcza Białowieska",
    description: "Ekologiczna osada w sercu Puszczy Białowieskiej. Marcin i Kasia prowadzą warsztaty przytulania drzew, uziemiania i świadomego życia w harmonii z naturą. Minimalizm, prostota, autentyczność.",
    image: "https://images.unsplash.com/photo-1754078219069-7565df2033b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlY28lMjBsb2RnZSUyMG5hdHVyZXxlbnwxfHx8fDE3NzE4ODYyMjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["100% eco", "Warsztaty forest bathing", "Wegańska kuchnia", "Łąka do medytacji"],
    capacity: "6-8 osób",
    rating: 4.9,
    contact: "kontakt@eko-osada-las.pl",
    color: "from-teal-500 to-green-600",
  },
];

export function OurPlaces() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-6 shadow-lg"
          >
            <MapPin className="text-purple-600" size={20} />
            <span className="text-purple-600 font-semibold">
              Nasze Miejsca
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Miejsca naszej społeczności
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto"
          >
            Hotele, apartamenty i domki prowadzone przez ludzi ze społeczności odjebao.me.
            Każde miejsce to przestrzeń dla świadomego odpoczynku, rozwoju i wspólnoty.
          </motion.p>
        </div>

        {/* Places Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {places.map((place, index) => (
            <motion.div
              key={place.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all group"
            >
              {/* Image */}
              <div className="relative h-64 overflow-hidden">
                <ImageWithFallback
                  src={place.image}
                  alt={place.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                
                {/* Owner Badge */}
                <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-semibold text-gray-800 flex items-center gap-1">
                  <Heart size={14} className="text-pink-500" />
                  {place.owner}
                </div>

                {/* Rating */}
                {place.rating && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-semibold text-gray-800 flex items-center gap-1">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    {place.rating}
                  </div>
                )}

                {/* Location */}
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <MapPin size={16} />
                    {place.location}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className={`text-2xl font-bold mb-2 bg-gradient-to-r ${place.color} bg-clip-text text-transparent`}>
                  {place.name}
                </h3>

                <p className="text-gray-600 mb-4 leading-relaxed">
                  {place.description}
                </p>

                {/* Amenities */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Coffee size={14} />
                    Co oferujemy:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {place.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 text-xs rounded-full font-medium"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Capacity */}
                <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
                  <Users size={16} className="text-purple-600" />
                  <span className="font-semibold">Pojemność:</span> {place.capacity}
                </div>

                {/* Contact Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {place.website && (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 py-3 px-4 bg-gradient-to-r ${place.color} text-white rounded-xl font-semibold text-center hover:shadow-lg transition-shadow flex items-center justify-center gap-2`}
                    >
                      Odwiedź stronę
                      <ExternalLink size={16} />
                    </a>
                  )}
                  {place.contact && (
                    <a
                      href={`mailto:${place.contact}`}
                      className="flex-1 py-3 px-4 bg-white border-2 border-purple-300 text-purple-600 rounded-xl font-semibold text-center hover:bg-purple-50 transition-colors"
                    >
                      Napisz do nas
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Masz swoje miejsce?
          </h2>
          <p className="text-lg mb-6 opacity-90 max-w-2xl mx-auto">
            Jeśli prowadzisz hotel, domki, apartamenty lub inne miejsce w duchu świadomego życia,
            dołącz do naszej społeczności!
          </p>
          <a
            href="mailto:kontakt@odjebao.me"
            className="inline-block py-4 px-8 bg-white text-purple-600 rounded-full font-bold text-lg hover:shadow-xl transition-shadow"
          >
            Skontaktuj się z nami
          </a>
        </motion.div>
      </div>
    </div>
  );
}
