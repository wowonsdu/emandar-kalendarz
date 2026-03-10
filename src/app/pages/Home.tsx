import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Heart,
  Brain,
  TreePine,
  Apple,
  Users,
  CalendarDays,
  Clock3,
  MapPin,
  ArrowRight,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState } from "react";
import { ExpandableTechnique } from "../components/ExpandableTechnique";

export function Home() {
  const techniques = [
    {
      icon: <Brain size={32} />,
      title: "Medytacja",
      description:
        "Odkryj spokój umysłu poprzez codzienną praktykę uważności i medytacji.",
      content: (
        <div className="pt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-lg mb-3 text-gray-800">
              Ćwiczenia na początek z Emandaru:
            </h4>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>
                  <strong>Oddech 4-7-8:</strong> Wdech przez nos (4 sek),
                  zatrzymaj oddech (7 sek), wydech ustami (8 sek)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>
                  <strong>Skanowanie ciała:</strong> Świadome przenoszenie uwagi
                  od stóp do głowy, obserwowanie napięć
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>
                  <strong>Medytacja loving-kindness:</strong> Wysyłanie
                  pozytywnych intencji do siebie i innych
                </span>
              </li>
            </ul>
          </div>
          <a
            href="https://emandar.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:shadow-lg transition-shadow"
          >
            Odkryj więcej na Emandar.pl
            <ExternalLink size={18} />
          </a>
        </div>
      ),
    },
    {
      icon: <Apple size={32} />,
      title: "Zdrowe odżywianie",
      description:
        "Bez cukru, bez gotowych produktów - tylko naturalne, pełnowartościowe jedzenie.",
      content: (
        <div className="pt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-lg mb-3 text-gray-800">
              Suplementy i naturalne wsparcie:
            </h4>
            <p className="text-gray-600 mb-4">
              Odkryj moc naturalnych składników, które wspierają Twoje ciało na
              poziomie komórkowym. Omega-3, witamina D3, K2, magnez, probiotyki, 
              adaptogeny - to tylko początek drogi do pełnej witalności i energii.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-lg mb-3 text-gray-800">
              Przepisy i filozofia jedzenia:
            </h4>
            <div className="space-y-3 text-gray-600">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                <p className="font-semibold text-green-800 mb-2">🌾 Makrobiotyka - Bożena Schleicher</p>
                <p className="text-sm">
                  Japońska filozofia żywienia oparta na równowadze yin i yang. 
                  Pełnoziarniste produkty, fermentowane warzywa, zupy miso - 
                  jedzenie jako medycyna.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl">
                <p className="font-semibold text-orange-800 mb-2">🥗 Gosia Bellwon - Świadome odżywianie</p>
                <p className="text-sm">
                  Proste, naturalne przepisy bez cukru i przetworzonej żywności.
                  Zielone smoothie, buddha bowls, fermentowane warzywa - jedzenie
                  jako energia i radość, nie tylko kalorie.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-3 text-gray-800">
              Sprawdzone źródła suplementów:
            </h4>
            <a
              href="https://duolife.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:shadow-lg transition-shadow"
            >
              Zobacz produkty Duo Life
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      ),
    },
    {
      icon: <TreePine size={32} />,
      title: "Połączenie z naturą",
      description:
        "Spacery po lesie, przytulanie drzew, odczuwanie energii natury.",
      content: (
        <div className="pt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-lg mb-3 text-gray-800">
              Shinrin-yoku (森林浴) - Kąpiel w lesie:
            </h4>
            <p className="text-gray-600 mb-4">
              Japońska praktyka świadomych spacerów w lesie. To nie chodzenie
              dla fitness - to bycie w lesie wszystkimi zmysłami. Badania
              pokazują, że zaledwie 15 minut w lesie obniża kortyzol, ciśnienie
              krwi i wzmacnia system immunologiczny.
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-blue-50 p-4 rounded-xl">
            <h5 className="font-semibold mb-2 text-gray-800">
              Jak praktykować:
            </h5>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">🌲</span>
                <span>Zostaw telefon w domu lub wyłącz go</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">🌲</span>
                <span>Idź powoli, bez celu - to nie wyprawa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">🌲</span>
                <span>Obserwuj wszystkie zmysły: zapach, dotyk, dźwięki</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">🌲</span>
                <span>Przytul drzewo - to nie żart, to terapia</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      icon: <Heart size={32} />,
      title: "Rozwój osobisty",
      description:
        "Świadome życie, praca nad sobą i budowanie lepszej wersji siebie.",
      content: (
        <div className="pt-6 space-y-6">
          <p className="text-gray-700 mb-4">
            Rozwój osobisty to nie one-size-fits-all. Każdy ma swoją ścieżkę.
            Wybierz co rezonuje z Tobą:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-100 hover:border-purple-300 transition-colors">
              <h5 className="font-semibold text-lg mb-2 text-purple-800">
                💼 Rozwój biznesu
              </h5>
              <p className="text-gray-600 mb-4 text-sm">
                Budowanie biznesu z wyższej wibracji. Kwantowe podejście do
                przedsiębiorczości, manifestacja przez wartości, nie manipulację.
              </p>
              <Link
                to="/nasi-ludzie"
                className="text-purple-600 font-semibold text-sm hover:underline inline-flex items-center gap-1"
              >
                Poznaj naszych przedsiębiorców
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-100 hover:border-blue-300 transition-colors">
              <h5 className="font-semibold text-lg mb-2 text-blue-800">
                🧘 Rozwój wewnętrzny
              </h5>
              <p className="text-gray-600 mb-4 text-sm">
                Głęboka praca nad sobą. Uzdrawianie, świadomość ciała, relacje z
                sobą i innymi. Odkrycie kim naprawdę jesteś poza maskami.
              </p>
              <Link
                to="/cwiczenie-5-minut"
                className="text-blue-600 font-semibold text-sm hover:underline inline-flex items-center gap-1"
              >
                Rozpocznij 5-minutowe ćwiczenie
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const trainings = [
    {
      date: "18 marca 2026",
      title: "Warsztat oddechu i wyciszania",
      time: "18:00-20:30",
      location: "Warszawa + transmisja online",
      format: "Stacjonarnie / online",
      spots: "12 wolnych miejsc",
      description:
        "Wieczorny warsztat dla osób, które chcą wrócić do równowagi, wyciszyć układ nerwowy i nauczyć się prostych technik na co dzień.",
    },
    {
      date: "26 marca 2026",
      title: "Szkolenie: zdrowe rytuały bez spiny",
      time: "19:00-21:00",
      location: "Online",
      format: "Spotkanie live",
      spots: "24 wolne miejsca",
      description:
        "Praktyczny przegląd nawyków wspierających energię, sen i regenerację. Bez skrajności, za to z konkretnym planem wdrożenia.",
    },
    {
      date: "11 kwietnia 2026",
      title: "Leśne kalendarium przebudzenia",
      time: "10:00-15:00",
      location: "Mazowiecki Park Krajobrazowy",
      format: "Warsztat terenowy",
      spots: "8 wolnych miejsc",
      description:
        "Dzień w naturze z praktyką uważności, pracą z intencją i ćwiczeniami pomagającymi odzyskać kontakt ze sobą.",
    },
    {
      date: "22 kwietnia 2026",
      title: "Krąg rozwoju osobistego",
      time: "18:30-21:00",
      location: "Kraków",
      format: "Grupa kameralna",
      spots: "5 wolnych miejsc",
      description:
        "Spotkanie dla osób, które chcą wymienić się doświadczeniem, dostać wsparcie i poukładać swoje kolejne kroki rozwojowe.",
    },
  ];

  const [showMore, setShowMore] = useState(false);
  const [expandedTechnique, setExpandedTechnique] = useState<number | null>(null);

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1694614513690-25cfb8e764f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3Jlc3QlMjBtZWRpdGF0aW9uJTIwbmF0dXJlfGVufDF8fHx8MTc3MTg3MjQxM3ww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Forest meditation"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-4">
              <span className="text-gray-700">Czujesz że Ci</span>
            </h1>
            
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-8">
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                ODJEBA*O?
              </span>
            </h1>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full mb-8 text-purple-600">
              <Sparkles size={20} />
              <span className="text-sm">Jesteś w dobrym miejscu</span>
            </div>

            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Jeśli znajomi patrzą na Ciebie dziwnie, bo zacząłeś medytować, zdrowo
              się odżywiać, chodzić do lasu i przytulać drzewa - nie jesteś sam.
              Przebudzenie ma różne formy, a my je celebrujemy!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/quiz">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2"
                >
                  Sprawdź jak bardzo Ci odjeba*o
                  <ArrowRight size={20} />
                </motion.button>
              </Link>

              <Link to="/poznaj-odjebao">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow border-2 border-purple-200"
                >
                  Poznaj odjebao
                </motion.button>
              </Link>

              <motion.a
                href="/#kalendarium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 text-gray-700 rounded-full font-semibold border border-white/70 bg-white/80 backdrop-blur-sm hover:bg-white transition-shadow shadow-lg"
              >
                Zobacz kalendarium
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Czym jest{" "}
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  odjebao.me
                </span>
                ?
              </h2>
              <p className="text-lg text-gray-600 mb-4">
                To społeczność ludzi, którzy zrozumieli, że prawdziwe życie zaczyna
                się, gdy przestaniesz żyć na autopilocie. Kiedy znajomi mówią "odjeba*o
                ci", bo:
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Przestałeś jeść śmieciowe jedzenie i cukier</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Zacząłeś medytować i praktykować uważność</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Chodzisz do lasu i doceniasz naturę</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Doceniasz małe rzeczy zamiast się nimi stresować</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Wolisz docenić i pochwalić zamiast narzekać i krytykować</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Odkryłeś energię, kwantowość życia</span>
                </li>
              </ul>
              <p className="text-lg text-gray-600 mt-6">
                ...to znaczy, że jesteś na dobrej drodze. 💜
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1613148442714-cfb57fa32456?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmVlJTIwaHVnZ2luZyUyMG5hdHVyZXxlbnwxfHx8fDE3NzE4NzI0MTV8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Nature connection"
                  className="w-full h-[500px] object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Techniques Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">
              Techniki świadomego życia
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Poznaj praktyki, które zmienią Twoje życie i pokażą Ci nową perspektywę
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {techniques.map((technique, index) => (
              <ExpandableTechnique
                key={technique.title}
                icon={technique.icon}
                title={technique.title}
                description={technique.description}
                index={index}
                content={technique.content}
                expanded={expandedTechnique === index}
                onExpand={() =>
                  setExpandedTechnique(expandedTechnique === index ? null : index)
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section
        id="kalendarium"
        className="py-20 bg-[radial-gradient(circle_at_top_left,_rgba(219,39,119,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_30%),linear-gradient(180deg,_#fff,_#fff7fb)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-14"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-pink-600 shadow-sm border border-pink-100 mb-5">
                <CalendarDays size={18} />
                <span className="text-sm font-semibold">Kalendarium</span>
              </div>
              <h2 className="text-4xl font-bold mb-4">
                Dostępne szkolenia i warsztaty
              </h2>
              <p className="text-lg text-gray-600">
                Zebraliśmy najbliższe terminy w jednym miejscu, żeby łatwo
                sprawdzić co dzieje się teraz i gdzie są jeszcze wolne miejsca.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm border border-pink-100 rounded-3xl p-6 shadow-xl max-w-md w-full">
              <p className="text-sm uppercase tracking-[0.18em] text-pink-500 mb-2">
                Najbliższy termin
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {trainings[0].title}
              </h3>
              <p className="text-gray-600 mb-4">{trainings[0].description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-pink-500" />
                  <span>{trainings[0].date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 size={16} className="text-pink-500" />
                  <span>{trainings[0].time}</span>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <MapPin size={16} className="text-pink-500" />
                  <span>{trainings[0].location}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {trainings.map((training, index) => (
              <motion.article
                key={`${training.date}-${training.title}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="group rounded-[2rem] border border-white/70 bg-white/95 p-7 shadow-lg shadow-pink-100/40 hover:-translate-y-1 hover:shadow-2xl transition-all"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-500 mb-3">
                      {training.date}
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {training.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {training.description}
                    </p>
                  </div>
                  <div className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-md">
                    {training.spots}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mt-6">
                  <div className="rounded-2xl bg-pink-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-pink-600 mb-1">
                      <Clock3 size={16} />
                      <span className="text-sm font-semibold">Godzina</span>
                    </div>
                    <p className="text-gray-700">{training.time}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <MapPin size={16} />
                      <span className="text-sm font-semibold">Miejsce</span>
                    </div>
                    <p className="text-gray-700">{training.location}</p>
                  </div>
                  <div className="rounded-2xl bg-purple-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <Users size={16} />
                      <span className="text-sm font-semibold">Format</span>
                    </div>
                    <p className="text-gray-700">{training.format}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Users size={48} className="mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-6">
              Dołącz do społeczności
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Poznaj ludzi, którzy myślą podobnie. Razem budujemy nowy świat
              oparty na świadomości, zdrowiu i autentyczności.
            </p>
            <Link to="/spolecznosc">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Zobacz jak się połączyć
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">
              Co mówią nasi członkowie?
            </h2>
            <p className="text-lg text-gray-600">
              Historie ludzi, którym "odjeba*o" - w najlepszym tego słowa znaczeniu
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Ania",
                text: "Znajomi myśleli, że zwariowałam jak zaczęłam przytulać drzewa. Teraz sami pytają o mój sekret spokoju i energii! 🌳",
                icon: "🌸",
              },
              {
                name: "Michał",
                text: "Rok temu byłem uzależniony od cukru i fast foodów. Dziś biegam maratony i czuję się jak nowa osoba. Warto było 'odlecieć'! 🚀",
                icon: "💪",
              },
              {
                name: "Kasia",
                text: "Ta społeczność pokazała mi, że nie jestem sama. Odkryłam medytację, zdrowe jedzenie i wreszcie spokój wewnętrzny. 🧘‍♀️",
                icon: "✨",
              },
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl shadow-lg"
              >
                <div className="text-4xl mb-4">{testimonial.icon}</div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
                <div className="font-semibold text-purple-600">
                  - {testimonial.name}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
