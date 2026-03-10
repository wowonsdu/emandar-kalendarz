import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowRight, Sparkles, Share2, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface QuizQuestion {
  id: string;
  question: string;
  description?: string;
  category: "basics" | "energy" | "business";
}

interface Expert {
  id: string;
  name: string;
  title: string;
  description: string;
  image: string;
  link: string;
  color: string;
}

const experts: Expert[] = [
  {
    id: "marcin",
    name: "Marcin",
    title: "Przewodnik natury",
    description: "Pomaga odnaleźć połączenie z naturą przez spacery po lesie, uziemianie i praktyki outdoor",
    image: "https://images.unsplash.com/photo-1705466877249-ce2c0d2e1baf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvdXRkb29yJTIwZ3VpZGUlMjBoaWtpbmclMjBtYWxlfGVufDF8fHx8MTc3MTg4NTczMHww&ixlib=rb-4.1.0&q=80&w=1080",
    link: "/nasi-ludzie",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "beata",
    name: "Beata",
    title: "Mentorka biznesu 3.0",
    description: "Wspiera w tworzeniu świadomego biznesu opartego na wartościach i misji",
    image: "https://images.unsplash.com/photo-1770627000564-3feb36aecbcd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHdvbWFuJTIwY29hY2glMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzcxODg1NzI3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    link: "/nasi-ludzie",
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "jacek",
    name: "Jacek",
    title: "Trener świadomości",
    description: "Prowadzi przez medytację, rozwój osobisty i praktyki uważności",
    image: "https://images.unsplash.com/photo-1618425977996-bebc5afe88f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGF0aW9uJTIwbWluZGZ1bG5lc3MlMjBtYWxlJTIwY29hY2h8ZW58MXx8fHwxNzcxODg1NzI3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    link: "/nasi-ludzie",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "asia",
    name: "Asia",
    title: "Praktykująca energetyki",
    description: "Pomaga w pracy z energią, czakramami i subtelnymi wibracjami",
    image: "https://images.unsplash.com/photo-1603669435608-eb647988e585?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmVyZ3klMjBoZWFsZXIlMjBzcGlyaXR1YWwlMjB3b21hbnxlbnwxfHx8fDE3NzE4ODU3Mjh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    link: "/nasi-ludzie",
    color: "from-violet-500 to-purple-600",
  },
];

const questions: QuizQuestion[] = [
  {
    id: "forest",
    question: "Od zgiełku galerii wybieram las i ciszę",
    description: "Połączenie z naturą zamiast konsumpcjonizmu",
    category: "basics",
  },
  {
    id: "natural-food",
    question: "Wybieram naturalne nieprzetwórzone jedzenie",
    description: "Świadome unikanie rafinowanego cukru, chemii i gotowców",
    category: "basics",
  },
  {
    id: "meditation",
    question: "Medytuję",
    description: "Codzienna praktyka uważności",
    category: "basics",
  },
  {
    id: "personal-dev",
    question: "Pracuję nad rozwojem osobistym",
    description: "Książki, kursy, świadomy rozwój",
    category: "basics",
  },
  {
    id: "affirmations",
    question: "Afirmuję, mówię o sobie i innych pozytywnie",
    description: "Świadome używanie pozytywnego języka i afirmacji",
    category: "basics",
  },
  {
    id: "healthy-food",
    question: "Interesuję się zdrowym żywieniem i suplementami",
    description: "Dbasz o to, co dostarczasz swojemu ciału",
    category: "basics",
  },
  {
    id: "nature-connection",
    question: "Łączę się z naturą",
    description: "Przytulam drzewa, uziemiam się, chodzę na boso",
    category: "basics",
  },
  {
    id: "energy",
    question: "Odczuwam energię i kwantowość życia",
    description: "Dostrzegasz subtelne energie i połączenia",
    category: "energy",
  },
  {
    id: "vibrations",
    question: "Czuję wibracje/rezonans z ludźmi i miejscami",
    description: "Rozpoznajesz energetyczne częstotliwości",
    category: "energy",
  },
  {
    id: "chakras",
    question: "Pracuję z energią i czakramami",
    description: "Świadomość systemów energetycznych ciała",
    category: "energy",
  },
  {
    id: "business-3",
    question: "Rozumiem koncepcję biznesu 3.0",
    description: "Biznes oparty na wartościach, misji i świadomości",
    category: "business",
  },
  {
    id: "conscious-business",
    question: "Prowadzę lub planuję świadomy biznes",
    description: "Przedsiębiorczość z głową i sercem",
    category: "business",
  },
];

export function Quiz() {
  const [answers, setAnswers] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

  const toggleAnswer = (id: string) => {
    const newAnswers = new Set(answers);
    if (newAnswers.has(id)) {
      newAnswers.delete(id);
    } else {
      newAnswers.add(id);
    }
    setAnswers(newAnswers);
  };

  const calculateResults = () => {
    const score = answers.size;
    const percentage = (score / questions.length) * 100;

    if (percentage >= 80) {
      return {
        level: "TOTALNIE",
        title: "Odjeba*o Ci totalnie! 🚀",
        description:
          "Jesteś mistrzem świadomego życia! Twoi znajomi pewnie już dawno przestali próbować Cię zrozumieć. Jesteś inspiracją dla innych i wzorem do naśladowania. Welcome to the enlightened club! ✨",
        color: "from-purple-600 to-pink-600",
        bgColor: "from-purple-50 to-pink-50",
      };
    } else if (percentage >= 60) {
      return {
        level: "MOCNO",
        title: "Odjeba*o Ci mocno! 💫",
        description:
          "Jesteś na bardzo dobrej drodze! Większość praktyk już wdrożyłeś i czujesz różnicę. Twoi znajomi zaczynają zauważać zmianę. Jeszcze kilka kroków i będziesz w pełni oświecony!",
        color: "from-blue-600 to-purple-600",
        bgColor: "from-blue-50 to-purple-50",
      };
    } else if (percentage >= 40) {
      return {
        level: "ŚREDNIO",
        title: "Odjeba*o Ci średnio 🌱",
        description:
          "Dobry start! Zacząłeś swoją podróż do świadomego życia. Niektóre praktyki już stosujesz, ale jest jeszcze pole do rozwoju. Nie poddawaj się - każdy krok się liczy!",
        color: "from-green-600 to-blue-600",
        bgColor: "from-green-50 to-blue-50",
      };
    } else if (percentage >= 20) {
      return {
        level: "LEKKO",
        title: "Odjeba*o Ci lekko 🌿",
        description:
          "Jesteś na samym początku drogi. Kilka praktyk już wypróbowałeś, ale to dopiero początek transformacji. Eksploruj dalej - najlepsze dopiero przed Tobą!",
        color: "from-yellow-600 to-green-600",
        bgColor: "from-yellow-50 to-green-50",
      };
    } else {
      return {
        level: "JESZCZE NIE",
        title: "Jeszcze Ci nie odjeba*o... ale może niedługo! 🌟",
        description:
          "Jesteś tu, więc już masz ciekawość! To pierwszy krok. Zacznij od małych zmian - może spacer w lesie? Trochę medytacji? Przebudzenie czeka tuż za rogiem!",
        color: "from-orange-600 to-yellow-600",
        bgColor: "from-orange-50 to-yellow-50",
      };
    }
  };

  const getPersonalizedRecommendations = () => {
    const answeredQuestions = questions.filter((q) => answers.has(q.id));
    const unansweredQuestions = questions.filter((q) => !answers.has(q.id));

    // Kategoryzuj odpowiedzi
    const hasBasics = answeredQuestions.some((q) => q.category === "basics");
    const hasEnergy = answeredQuestions.some((q) => q.category === "energy");
    const hasBusiness = answeredQuestions.some((q) => q.category === "business");

    const recommendations = [];

    // Rekomendacje do zgłębienia
    const toExplore = [];
    if (!answers.has("meditation")) {
      toExplore.push({
        title: "Medytacja dla początkujących",
        description: "Rozpocznij od 5 minut dziennie - zmień swoje życie",
        icon: "🧘",
      });
    }
    if (!answers.has("chakras") && hasBasics) {
      toExplore.push({
        title: "Praca z czakramami",
        description: "Odkryj system energetyczny swojego ciała",
        icon: "💫",
      });
    }
    if (!answers.has("vibrations") && hasEnergy) {
      toExplore.push({
        title: "Wibracje i rezonans",
        description: "Naucz się rozpoznawać energetyczne częstotliwości",
        icon: "〰️",
      });
    }
    if (!answers.has("business-3") && (hasBasics || hasEnergy)) {
      toExplore.push({
        title: "Biznes 3.0",
        description: "Przedsiębiorczość oparta na wartościach i misji",
        icon: "🚀",
      });
    }

    // Produkty do sprzedania
    const products = [];
    if (answers.size >= 5) {
      products.push({
        title: 'Książka "Odjebao - Manifest Świadomego Życia"',
        description: "Kompendium wiedzy o transformacji świadomości",
        icon: "📖",
        link: "/sklep",
      });
    }
    if (hasEnergy) {
      products.push({
        title: "Kurs online: Energia i Czakramy",
        description: "4-tygodniowy program pracy z systemem energetycznym",
        icon: "✨",
        link: "/sklep",
      });
    }
    if (hasBusiness) {
      products.push({
        title: "Szkolenie: Biznes 3.0 w praktyce",
        description: "Stwórz biznes oparty na misji i wartościach",
        icon: "💼",
        link: "/sklep",
      });
    }

    // Ćwiczenia
    const exercises = [];
    if (!answers.has("meditation") || answers.size < 7) {
      exercises.push({
        title: "5 minut by poczuć się lepiej",
        description: "Natychmiastowa praktyka uśmiechania organów",
        icon: "😊",
        link: "/cwiczenie-5-minut",
      });
    }
    if (hasBasics && !hasEnergy) {
      exercises.push({
        title: "Praktyka wibracji",
        description: "Codzienne ćwiczenia rozpoznawania energii",
        icon: "〰️",
        link: "#",
      });
    }

    return { toExplore, products, exercises };
  };

  const getRecommendedExperts = (): Expert[] => {
    const recommendedExperts: Expert[] = [];
    
    // Natura - dla tych którzy wybrali forest lub nature-connection
    const hasNature = answers.has("forest") || answers.has("nature-connection");
    if (hasNature) {
      const marcin = experts.find((e) => e.id === "marcin");
      if (marcin) recommendedExperts.push(marcin);
    }
    
    // Biznes - dla tych którzy wybrali business-3 lub conscious-business
    const hasBusiness = answers.has("business-3") || answers.has("conscious-business");
    if (hasBusiness) {
      const beata = experts.find((e) => e.id === "beata");
      if (beata) recommendedExperts.push(beata);
    }
    
    // Świadomość - dla tych którzy wybrali meditation, personal-dev lub affirmations
    const hasConsciousness = answers.has("meditation") || answers.has("personal-dev") || answers.has("affirmations");
    if (hasConsciousness) {
      const jacek = experts.find((e) => e.id === "jacek");
      if (jacek) recommendedExperts.push(jacek);
    }
    
    // Energia - dla tych którzy wybrali energy, vibrations lub chakras
    const hasEnergy = answers.has("energy") || answers.has("vibrations") || answers.has("chakras");
    if (hasEnergy) {
      const asia = experts.find((e) => e.id === "asia");
      if (asia) recommendedExperts.push(asia);
    }
    
    return recommendedExperts;
  };

  const handleSubmit = () => {
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetQuiz = () => {
    setAnswers(new Set());
    setShowResults(false);
  };

  const results = showResults ? calculateResults() : null;
  const recommendations = showResults ? getPersonalizedRecommendations() : null;
  const recommendedExperts = showResults ? getRecommendedExperts() : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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
                    Quiz świadomości
                  </span>
                </motion.div>

                <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                  Jak bardzo{" "}
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Ci odjeba*o?
                  </span>
                </h1>
                <p className="text-lg text-gray-600">
                  Zaznacz wszystkie praktyki, które stosujesz w swoim życiu
                </p>
              </div>

              {/* Questions */}
              <div className="space-y-4 mb-8">
                {questions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => toggleAnswer(question.id)}
                      className={`w-full text-left p-6 rounded-2xl border-2 transition-all ${
                        answers.has(question.id)
                          ? "border-purple-500 bg-white shadow-lg"
                          : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            answers.has(question.id)
                              ? "bg-gradient-to-r from-purple-600 to-pink-600 border-transparent"
                              : "border-gray-300"
                          }`}
                        >
                          {answers.has(question.id) && (
                            <Check size={16} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">
                            {question.question}
                          </h3>
                          {question.description && (
                            <p className="text-gray-500 text-sm">
                              {question.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Progress */}
              <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Twój postęp</span>
                  <span className="font-semibold text-purple-600">
                    {answers.size} / {questions.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(answers.size / questions.length) * 100}%`,
                    }}
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 text-lg"
              >
                Zobacz wyniki
                <ArrowRight size={20} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`bg-gradient-to-br ${results.bgColor} p-8 rounded-3xl shadow-2xl`}
            >
              {/* Results */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="w-32 h-32 mx-auto mb-6 rounded-full bg-white shadow-lg flex items-center justify-center"
                >
                  <span className="text-5xl">
                    {results.level === "TOTALNIE"
                      ? "🚀"
                      : results.level === "MOCNO"
                      ? "💫"
                      : results.level === "ŚREDNIO"
                      ? "🌱"
                      : results.level === "LEKKO"
                      ? "🌿"
                      : "🌟"}
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`text-4xl font-bold mb-4 bg-gradient-to-r ${results.color} bg-clip-text text-transparent`}
                >
                  {results.title}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto"
                >
                  {results.description}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white p-6 rounded-2xl shadow-lg mb-8 inline-block"
                >
                  <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    {answers.size}/{questions.length}
                  </div>
                  <div className="text-gray-600">praktyk świadomego życia</div>
                </motion.div>
              </div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <button
                  onClick={() => {
                    navigator.share?.({
                      title: "Quiz odjebao.me",
                      text: `${results.title} - Sprawdź jak bardzo Tobie odjeba*o!`,
                      url: window.location.href,
                    });
                  }}
                  className="flex-1 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                >
                  <Share2 size={20} />
                  Podziel się wynikami
                </button>

                <button
                  onClick={resetQuiz}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
                >
                  Zrób quiz ponownie
                </button>
              </motion.div>

              {/* Next Steps */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="mt-8 space-y-6"
              >
                {/* Personalized Recommendations */}
                {(() => {
                  const recs = getPersonalizedRecommendations();
                  return (
                    <>
                      {/* Things to Explore */}
                      {recs.toExplore.length > 0 && (
                        <div className="p-6 bg-white rounded-2xl shadow-lg">
                          <h3 className="font-semibold text-xl mb-4 text-center text-purple-600">
                            🌱 Co możesz zgłębić dalej?
                          </h3>
                          <div className="space-y-3">
                            {recs.toExplore.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-800 mb-1">
                                      {item.title}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {item.description}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exercises */}
                      {recs.exercises.length > 0 && (
                        <div className="p-6 bg-white rounded-2xl shadow-lg">
                          <h3 className="font-semibold text-xl mb-4 text-center text-purple-600">
                            💫 Praktyczne ćwiczenia dla Ciebie
                          </h3>
                          <div className="space-y-3">
                            {recs.exercises.map((item, idx) => (
                              <Link
                                key={idx}
                                to={item.link}
                                className="block p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <div className="flex-1">
                                    <div className="font-semibold text-purple-600 mb-1">
                                      {item.title}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {item.description}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Products */}
                      {recs.products.length > 0 && (
                        <div className="p-6 bg-white rounded-2xl shadow-lg">
                          <h3 className="font-semibold text-xl mb-4 text-center text-purple-600">
                            ✨ Polecamy dla Ciebie
                          </h3>
                          <div className="space-y-3">
                            {recs.products.map((item, idx) => (
                              <Link
                                key={idx}
                                to={item.link}
                                className="block p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <div className="flex-1">
                                    <div className="font-semibold text-purple-600 mb-1">
                                      {item.title}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {item.description}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Recommended Experts */}
                {recommendedExperts && recommendedExperts.length > 0 && (
                  <div className="p-6 bg-white rounded-2xl shadow-lg">
                    <h3 className="font-semibold text-xl mb-2 text-center text-purple-600">
                      🌟 Na podstawie Twoich wartości i kierunku rozwoju
                    </h3>
                    <p className="text-sm text-gray-600 text-center mb-6">
                      Najbliżej Ci do {recommendedExperts.map((e, i) => (
                        <span key={e.id}>
                          {i > 0 && (i === recommendedExperts.length - 1 ? " i " : ", ")}
                          <span className="font-semibold text-purple-700">{e.name}</span>
                        </span>
                      ))}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {recommendedExperts.map((expert, idx) => (
                        <motion.div
                          key={expert.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 + idx * 0.1 }}
                        >
                          <Link
                            to={expert.link}
                            className="block group bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl overflow-hidden hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-300"
                          >
                            <div className="relative h-48 overflow-hidden">
                              <ImageWithFallback
                                src={expert.image}
                                alt={expert.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className={`absolute top-3 right-3 px-3 py-1 rounded-full bg-gradient-to-r ${expert.color} text-white text-xs font-semibold`}>
                                Rekomendowany
                              </div>
                            </div>
                            <div className="p-4">
                              <h4 className="font-bold text-lg mb-1 text-gray-800">
                                {expert.name}
                              </h4>
                              <p className={`text-sm font-semibold mb-2 bg-gradient-to-r ${expert.color} bg-clip-text text-transparent`}>
                                {expert.title}
                              </p>
                              <p className="text-sm text-gray-600 mb-3">
                                {expert.description}
                              </p>
                              <div className="flex items-center justify-between text-purple-600 font-semibold text-sm">
                                <span>Zobacz więcej</span>
                                <ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Default links */}
                <div className="p-6 bg-white rounded-2xl shadow-lg">
                  <h3 className="font-semibold text-xl mb-4 text-center">
                    Co dalej?
                  </h3>
                  <div className="space-y-3">
                    <Link
                      to="/sklep"
                      className="block p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:shadow-md transition-shadow"
                    >
                      <div className="font-semibold text-purple-600 mb-1">
                        Pokaż znajomym kto ma rację
                      </div>
                      <div className="text-sm text-gray-600">
                        Sprawdź nasze produkty z logo odjebao
                      </div>
                    </Link>
                    <Link
                      to="/spolecznosc"
                      className="block p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:shadow-md transition-shadow"
                    >
                      <div className="font-semibold text-purple-600 mb-1">
                        Dołącz do społeczności
                      </div>
                      <div className="text-sm text-gray-600">
                        Poznaj ludzi, którzy myślą podobnie
                      </div>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}