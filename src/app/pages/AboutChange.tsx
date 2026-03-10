import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  Users,
  Shield,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function AboutChange() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const steps = [
    {
      icon: <Shield size={32} />,
      title: "Nie zmieniaj ich na siłę",
      description:
        "Twoi znajomi nie są Twoimi wrogami. Po prostu jeszcze nie są gotowi na zrozumienie tego, co Ty już odkryłeś. Szanuj ich ścieżkę.",
      expandedContent: {
        intro: "Każdy człowiek ma swój własny timing. Twoja transformacja jest Twoją podróżą - nie ich.",
        sections: [
          {
            title: "Dlaczego to nie działa?",
            text: "Kiedy próbujesz kogoś zmieniać na siłę, jego ego automatycznie się broni. To naturalna reakcja obronna umysłu. Im bardziej naciskasz, tym większy opór budujesz.",
          },
          {
            title: "Energetyczna perspektywa",
            text: "Każdy człowiek wibruje na określonej częstotliwości. Twoja zmiana podniosła Twoją wibrację, ale oni jeszcze rezonują z poprzednim poziomem. Szanując ich ścieżkę, pozwalasz wszechświatowi działać w idealnym czasie.",
          },
          {
            title: "Co możesz zrobić?",
            text: "Zamiast przekonywać, bądź obecny. Zamiast tłumaczyć, po prostu żyj swoją prawdą. Twoja energia mówi więcej niż tysiąc argumentów.",
          },
        ],
      },
    },
    {
      icon: <Sparkles size={32} />,
      title: "Zmieniaj się cicho",
      description:
        "Prawdziwa transformacja nie potrzuje rozgłosu ani deklaracji. Twoje działania mówią więcej niż tysiąc słów.",
      expandedContent: {
        intro: "Cicha transformacja to najsilniejsza forma zmiany. Jak wiatr - niewidzialny, ale potężny.",
        sections: [
          {
            title: "Moc ciszy",
            text: "Kiedy zmieniasz się w ciszy, nie wywołujesz oporu w innych. Nie musisz się tłumaczyć, bronić ani przekonywać. Po prostu JESTEŚ.",
          },
          {
            title: "Energetyczna alchemia",
            text: "Głośne deklaracje rozpraszają energię. Cicha praca wewnętrzna koncentruje ją. To jak różnica między ogniskiem a laserem - oba mają ogień, ale laser ma fokus.",
          },
          {
            title: "Praktyka codzienności",
            text: "Medytuj bez opowiadania o tym na story. Jedz zdrowo bez wykładów o diecie. Ćwicz bez postowania na Instagramie. Niech Twoje ciało i umysł będą Twoim manifestem.",
          },
        ],
      },
    },
    {
      icon: <Heart size={32} />,
      title: "Pamiętaj skąd przyszedłeś",
      description:
        "Ty też jeszcze chwilę temu nie byłeś przebudzony. Teraz jesteś. To nie czyni Cię lepszym - po prostu innym.",
      expandedContent: {
        intro: "Pokora to fundament prawdziwej mądrości. Pamiętanie swojej drogi chroni przed duchową pychą.",
        sections: [
          {
            title: "Twoja poprzednia wersja",
            text: "Kiedyś Ty też jadłeś fast foody, scrollowałeś bez końca social media i nie rozumiałeś 'dziwnych' ludzi, którzy chodzą do lasu. Twoja zmiana była procesem, nie nagłym olśnieniem.",
          },
          {
            title: "Współczucie zamiast wyższości",
            text: "Każdy jest dokładnie tam, gdzie powinien być w swojej ewolucji świadomości. Nie jesteś lepszy - jesteś po prostu dalej na TWOJEJ ścieżce. Oni są dokładnie tam, gdzie być powinni na SWOJEJ.",
          },
          {
            title: "Energetyczna równowaga",
            text: "Duchowa pycha obniża Twoją wibrację szybciej niż fast food. Prawdziwe przebudzenie zawiera w sobie głęboką pokorę i zrozumienie, że wszyscy jesteśmy w drodze.",
          },
        ],
      },
    },
    {
      icon: <Users size={32} />,
      title: "Inspiruj, nie namawiaj",
      description:
        "Dziel się swoją wiedzą, gdy ktoś pyta. Nie naciskaj, gdy nie jest gotowy. Mądrość nie krzyczy - szepcze.",
      expandedContent: {
        intro: "Inspiracja płynie naturalnie z autentycznego życia. Namawianie tworzy opór.",
        sections: [
          {
            title: "Różnica energetyczna",
            text: "Namawianie pochodzi z ego ('chcę Cię przekonać'). Inspirowanie pochodzi z serca ('chcę podzielić się radością'). Ludzie czują tę różnicę na poziomie energetycznym, nawet jeśli nieświadomie.",
          },
          {
            title: "Kiedy dzielić się wiedzą?",
            text: "Gdy ktoś PYTA. Gdy widzisz prawdziwą ciekawość w oczach. Gdy czujesz rezonans. To są sygnały, że ktoś jest gotowy. Wszystko inne to tylko rozpraszanie Twojej energii.",
          },
          {
            title: "Jak inspirować?",
            text: "Opowiadaj o SWOIM doświadczeniu, nie o uniwersalnych prawdach. 'Ja czuję się lepiej' zamiast 'Ty powinieneś'. Dziel się radością, nie doktrynami. Zapraszaj, nie zmuszaj.",
          },
        ],
      },
    },
    {
      icon: <Sparkles size={32} />,
      title: "Znajdź swoją społeczność",
      description:
        "Otaczaj się ludźmi, którzy Cię rozumieją. Społeczność świadomych dusz to paliwnik do Twojej transformacji.",
      expandedContent: {
        intro: "Nie jesteś sam. Tysiące ludzi przeszło tę samą drogę i czeka, by podzielić się wsparciem.",
        sections: [
          {
            title: "Rezonans energetyczny",
            text: "Kiedy otaczasz się ludźmi na podobnej częstotliwości, Twoja energia automatycznie się wzmacnia. To jak efekt pola morfogenetycznego - wspólna wibracja wzmacnia transformację każdego.",
          },
          {
            title: "Bezpieczna przestrzeń",
            text: "W społeczności świadomych ludzi nie musisz się tłumaczyć. Możesz mówić o medytacji, energii, wibracji bez strachu przed oceną. To miejsce, gdzie możesz być w pełni sobą.",
          },
          {
            title: "Wzajemne wsparcie",
            text: "Transformacja to góra z wzlotami i upadkami. Społeczność to sieć bezpieczeństwa, która łapie Cię gdy spadasz i świętuje gdy się wznosisz. Together we rise.",
          },
        ],
      },
    },
    {
      icon: <Heart size={32} />,
      title: "Żyj swoją prawdą",
      description:
        "Ostatecznie, najważniejsze jest bycie autentycznym. Twoja prawda to Twój największy dar dla świata.",
      expandedContent: {
        intro: "Świat nie potrzebuje kolejnej kopii. Potrzebuje autentycznego CIEBIE.",
        sections: [
          {
            title: "Co to znaczy żyć prawdą?",
            text: "To znaczy być w zgodzie ze swoimi wartościami, nawet gdy inni nie rozumieją. To wybierać medytację zamiast Netflix, sałatkę zamiast fast foodu, las zamiast centrum handlowego - bo TO jest Twoje prawdziwe JA.",
          },
          {
            title: "Magnetyzm autentyczności",
            text: "Kiedy żyjesz swoją prawdą, stajesz się jak latarnia morska. Nie musisz nikogo przekonywać - Twoja energia przyciąga tych, którzy są gotowi. Autentyczność jest najsilniejszym magnesem.",
          },
          {
            title: "Wpływ na kollektyw",
            text: "Każda osoba żyjąca w autentyczności podnosi wibrację całej planety. Twoja transformacja to nie tylko Twoja sprawa - to dar dla całego świata. Bądź zmianą, którą chcesz widzieć.",
          },
        ],
      },
    },
  ];

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Transformation journey"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 leading-tight"
            >
              Znajomi mówią że Ci odjeba*o?{" "}
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                - to początek wspaniałej przygody!
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="my-16"
            >
              <p className="text-6xl sm:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
                Zmiana,
              </p>
              <p className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-700">
                to jedyna stała.
              </p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xl sm:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed"
            >
              Wszechświat ewoluuje, natura się zmienia, a Ty - jako część tego
              wszystkiego - także doświadczasz transformacji. To nie przypadek.
              To droga.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed mt-4"
            >
              Wszystko jest <strong className="text-purple-600">energią</strong>, wszystko{" "}
              <strong className="text-purple-600">wibruje</strong>, wszystko jest w ciągłym ruchu.
              Niektóre rzeczy wibrują tak szybko - jak światło, myśli, emocje - że ledwo to
              rejestrujemy. Inne tak wolno - jak góry, drzewa, kamienie - że wydają się
              nieruchome. Ale to iluzja. Wszystko tańczy w kosmicznym rytmie częstotliwości.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Understanding Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <Heart
              size={64}
              className="mx-auto mb-6 text-purple-600"
              strokeWidth={1.5}
            />
            <h2 className="text-4xl font-bold mb-6">
              Dlaczego ich to{" "}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                zaskakuje?
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 sm:p-12 rounded-3xl shadow-lg"
          >
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Kiedy <strong>Ty się zmieniasz</strong>, Twoje środowisko nie
              rozumie tej transformacji. Ich umysły są przyzwyczajone do
              „starego Ciebie" - do Twoich starych nawyków, przekonań i
              zachowań.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Kiedy nagle zaczynasz medytować zamiast pić piwo, jeść sałatki
              zamiast pizzy, chodzić do lasu zamiast do klubu - dla nich to{" "}
              <strong className="text-purple-600">akt agresji</strong>.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Nie dlatego, że robisz coś złego. Ale dlatego, że{" "}
              <strong>zmieniło się w Tobie coś</strong>, na co ich umysły nie
              są jeszcze gotowe. Twoja zmiana jest lustrem, które pokazuje im
              możliwość - a ta możliwość może być przerażająca.
            </p>
            <div className="bg-white p-6 rounded-2xl border-l-4 border-purple-600 mt-8">
              <p className="text-xl font-semibold text-gray-800 italic">
                „Ludzie nie boją się Twojej zmiany. Boją się swojej własnej
                możliwości zmiany."
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Jak wtedy postąpić?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Fundamentalne zasady dla tych, którzy wybierają świadomą transformację
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, index) => {
              const isExpanded = expandedCard === index;
              return (
                <motion.div
                  key={step.title}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, layout: { duration: 0.4 } }}
                  className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all ${
                    isExpanded ? "sm:col-span-2 lg:col-span-3" : ""
                  }`}
                >
                  {/* Card Header - Always Visible */}
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : index)}
                    className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600 rounded-xl flex items-center justify-center">
                        {step.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-800">
                          {step.title}
                        </h3>
                        {!isExpanded && (
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {step.description}
                          </p>
                        )}
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex-shrink-0 text-purple-600"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 space-y-4">
                          {/* Intro */}
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-l-4 border-purple-600">
                            <p className="text-base text-gray-700 leading-relaxed font-medium">
                              {step.expandedContent.intro}
                            </p>
                          </div>

                          {/* Sections */}
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {step.expandedContent.sections.map((section, secIndex) => (
                              <motion.div
                                key={secIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: secIndex * 0.1 }}
                                className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                              >
                                <h4 className="text-base font-semibold mb-2 text-purple-600 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                                  {section.title}
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {section.text}
                                </p>
                              </motion.div>
                            ))}
                          </div>

                          {/* Footer */}
                          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-xl text-white text-center">
                            <p className="text-sm font-semibold opacity-90">
                              Pamiętaj: Każda zmiana zaczyna się od jednego kroku. Ty już go zrobiłeś. 💜
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Twoja droga jest{" "}
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  wyjątkowa
                </span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Nie ma jednej właściwej ścieżki. Niektórzy odkrywają medytację,
                inni joga, jeszcze inni zdrowe odżywianie czy połączenie z
                naturą. Wszystkie drogi prowadzą do tego samego miejsca -
                autentycznego, świadomego życia.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                A kiedy ju tam dotrzesz, zauważysz coś pięknego: Ci znajomi,
                którzy dziś patrzą na Ciebie z niedowierzaniem, jutro będą
                przychodzić po poradę. Bo <strong>światło przyciąga</strong>.
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
                  src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Journey of transformation"
                  className="w-full h-[400px] object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Nie jesteś sam w tej podróży
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Dołącz do tysięcy ludzi, którzy też „odlecieli" i teraz wspólnie
              budują społeczność opartą na świadomości, zdrowiu i autentyczności.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="/quiz"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Sprawdź jak bardzo Ci odjeba*o
              </motion.a>
              <motion.a
                href="/spolecznosc"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent text-white border-2 border-white rounded-full font-semibold shadow-lg hover:bg-white/10 transition-all"
              >
                Poznaj społeczność
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}