import { motion } from "motion/react";
import {
  Users,
  MessageCircle,
  Calendar,
  MapPin,
  BookOpen,
  Heart,
  Sparkles,
  Instagram,
  Facebook,
  Youtube,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Community() {
  const platforms = [
    {
      icon: <MessageCircle size={32} />,
      title: "Grupa Discord",
      description:
        "Dołącz do naszej aktywnej społeczności na Discord. Codzienne rozmowy, wsparcie i wymiana doświadczeń.",
      action: "Dołącz do Discord",
      color: "from-indigo-500 to-purple-500",
    },
    {
      icon: <Instagram size={32} />,
      title: "Instagram",
      description:
        "Śledź nas na Instagramie. Codzienne inspiracje, cytaty i historie od członków społeczności.",
      action: "Obserwuj na IG",
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: <Facebook size={32} />,
      title: "Grupa Facebook",
      description:
        "Prywatna grupa na Facebooku. Dziel się swoją podróżą i poznawaj ludzi z Twojej okolicy.",
      action: "Dołącz do grupy",
      color: "from-blue-500 to-indigo-500",
    },
    {
      icon: <Youtube size={32} />,
      title: "YouTube",
      description:
        "Kanał pełen poradników, medytacji prowadzonych i wywiadów z inspirującymi ludźmi.",
      action: "Subskrybuj kanał",
      color: "from-red-500 to-pink-500",
    },
  ];

  const events = [
    {
      title: "Poranna medytacja grupowa",
      date: "Każda niedziela, 8:00",
      location: "Online (Zoom)",
      description: "Wspólna praktyka medytacji, aby rozpocząć tydzień z dobrą energią.",
    },
    {
      title: "Spacer po lesie - Warszawa",
      date: "1 marca 2026, 10:00",
      location: "Las Kabacki, Warszawa",
      description: "Spotkanie na żywo, spacer, przytulanie drzew i wymiana doświadczeń.",
    },
    {
      title: "Warsztat zdrowego gotowania",
      date: "8 marca 2026, 14:00",
      location: "Online (YouTube Live)",
      description: "Gotujemy razem zdrowe, roślinnne posiłki bez cukru i gotowych produktów.",
    },
    {
      title: "Q&A o świadomym życiu",
      date: "Każdy czwartek, 19:00",
      location: "Discord",
      description: "Odpowiadamy na pytania, dzielimy się wiedzą i wspieramy się nawzajem.",
    },
  ];

  const resources = [
    {
      icon: <BookOpen size={24} />,
      title: "Biblioteka zasobów",
      description:
        "Darmowe e-booki, artykuły, poradniki medytacyjne i plany żywieniowe.",
    },
    {
      icon: <Users size={24} />,
      title: "Mentorzy",
      description:
        "Doświadczeni członkowie społeczności, którzy pomogą Ci na Twojej drodze.",
    },
    {
      icon: <Heart size={24} />,
      title: "Wsparcie",
      description:
        "Zawsze znajdziesz kogoś, kto wysłucha i pomoże w trudnych momentach.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-6 shadow-lg"
            >
              <Sparkles className="text-purple-600" size={20} />
              <span className="text-purple-600 font-semibold">
                Razem jesteśmy silniejsi
              </span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Dołącz do{" "}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                społeczności
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Poznaj ludzi, którzy też "odlecieli" i budują nowy świat oparty na
              świadomości, zdrowiu i autentyczności. Nie jesteś sam!
            </p>
          </div>

          {/* Community Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl overflow-hidden shadow-2xl mb-16 max-w-4xl mx-auto"
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1542315099045-93937d70c67a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBwZW9wbGUlMjB0b2dldGhlcnxlbnwxfHx8fDE3NzE4NTk2Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Community"
              className="w-full h-96 object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Gdzie nas znaleźć?
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${platform.color} rounded-xl flex items-center justify-center text-white mb-4`}
                >
                  {platform.icon}
                </div>
                <h3 className="text-2xl font-semibold mb-3">{platform.title}</h3>
                <p className="text-gray-600 mb-6">{platform.description}</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full py-3 bg-gradient-to-r ${platform.color} text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow`}
                >
                  {platform.action}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Nadchodzące wydarzenia</h2>
            <p className="text-gray-600">
              Spotkania, warsztaty i aktywności dla społeczności
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {events.map((event, index) => (
              <motion.div
                key={event.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-100 hover:border-purple-300 transition-colors"
              >
                <h3 className="text-xl font-semibold mb-3">{event.title}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={18} className="text-purple-600" />
                    <span className="text-sm">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={18} className="text-purple-600" />
                    <span className="text-sm">{event.location}</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">{event.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Co oferuje społeczność?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {resources.map((resource, index) => (
              <motion.div
                key={resource.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-lg text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center text-purple-600 mx-auto mb-4">
                  {resource.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{resource.title}</h3>
                <p className="text-gray-600">{resource.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-white text-center shadow-2xl"
          >
            <h2 className="text-3xl font-bold mb-4">
              Gotowy na nową przygodę?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Dołącz do tysięcy ludzi, którym "odjebało" i razem zmieniajmy świat
              na lepsze. Pierwsze kroki zawsze są najtrudniejsze, ale nie musisz
              ich stawiać sam.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Dołącz teraz
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-semibold hover:bg-white/10 transition-colors"
              >
                Dowiedz się więcej
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Nasze wartości
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { emoji: "🌱", title: "Rozwój", text: "Ciągłe doskonalenie siebie" },
              {
                emoji: "💜",
                title: "Wsparcie",
                text: "Pomagamy sobie nawzajem",
              },
              {
                emoji: "🌿",
                title: "Natura",
                text: "Szacunek dla środowiska",
              },
              {
                emoji: "✨",
                title: "Autentyczność",
                text: "Bądź sobą bez udawania",
              },
            ].map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-5xl mb-4">{value.emoji}</div>
                <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}