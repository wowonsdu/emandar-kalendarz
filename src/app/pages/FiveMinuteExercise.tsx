import { useState, useRef } from "react";
import { motion } from "motion/react";
import {
  Play,
  Pause,
  Camera,
  Smile,
  Heart,
  Brain,
  ChevronRight,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function FiveMinuteExercise() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              console.log("Audio playback prevented:", error);
              setIsPlaying(false);
            });
        }
      }
    }
  };

  const steps = [
    {
      icon: <Camera size={24} />,
      title: "Ustaw telefon",
      description:
        "Postaw telefon naprzeciwko siebie tak, aby widział Twoją twarz. Możesz użyć podstawki lub podeprzeć go książkami.",
    },
    {
      icon: <Camera size={24} />,
      title: "Naciśnij nagrywanie",
      description:
        "Włącz kamerę frontową i rozpocznij nagrywanie wideo. Chcemy uchwycić transformację Twojej twarzy podczas praktyki.",
    },
    {
      icon: <Smile size={24} />,
      title: "Zamknij oczy",
      description:
        "Usiądź wygodnie, wyprostuj kręgosłup, delikatnie zamknij oczy. Skieruj uwagę do wewnątrz.",
    },
    {
      icon: <Play size={24} />,
      title: "Odtwórz guided audio",
      description:
        "Kliknij 'Play' poniżej i pozwól, aby prowadzący głos przeprowadził Cię przez praktykę uśmiechania organów.",
    },
    {
      icon: <Heart size={24} />,
      title: "Obserwuj zmianę",
      description:
        "Po zakończeniu obejrzyj nagranie. Zobaczysz jak Twoja twarz się rozluźniła, jak zmienił się wyraz, energia. To dowód transformacji.",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Meditation peace"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full mb-6 text-purple-600">
              <Smile size={20} />
              <span className="text-sm font-semibold">
                Natychmiastowa transformacja
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="text-gray-700">5 minut</span>
              <br />
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                by poczuć się lepiej
              </span>
            </h1>

            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
              Starożytna taoistyczna praktyka <strong>uśmiechania organów</strong>{" "}
              - technika, która natychmiast zmienia Twoją energię, twarz i
              samopoczucie.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What is this */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-8 sm:p-12 rounded-3xl shadow-xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                <Brain size={32} className="text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold">Czym jest uśmiechanie organów?</h2>
            </div>

            <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
              <p>
                To praktyka z medycyny chińskiej i taoizmu, która polega na{" "}
                <strong>świadomym wysyłaniu ciepła, wdzięczności i uśmiechu</strong>{" "}
                do każdego organu w Twoim ciele.
              </p>
              <p>
                Kiedy uśmiechasz się do swoich organów - serca, wątroby, nerek,
                płuc - one <strong className="text-purple-600">odpowiadają</strong>.
                Zmieniają swoją wibrację, relaksują się, zaczynają funkcjonować
                harmonijnie.
              </p>
              <p>
                Efekt jest natychmiastowy i <strong>widoczny</strong>. Twoja
                twarz się rozluźnia, oczy nabierają blasku, cała Twoja energia
                się zmienia. Dlatego nagrywamy - żebyś zobaczył tę transformację
                na własne oczy.
              </p>
            </div>

            <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-l-4 border-purple-600">
              <p className="text-lg font-semibold text-gray-800 italic">
                "Kiedy uśmiechasz się do swoich organów, one uśmiechają się z
                powrotem do Ciebie. To zmienia wszystko."
              </p>
              <p className="text-sm text-gray-600 mt-2">- Mantak Chia, mistrz taoizmu</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Instructions */}
      {showInstructions && (
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold mb-4">Jak to zrobić?</h2>
              <p className="text-lg text-gray-600">
                Wykonaj te kroki, a zobaczysz transformację na własnej twarzy
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white p-6 rounded-2xl shadow-lg relative"
                >
                  <div className="absolute -top-4 -left-4 w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                    {index + 1}
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 mt-2">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-800">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              ))}

              {/* Continue button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowInstructions(false)}
              >
                <ChevronRight size={48} className="mb-4" />
                <p className="text-xl font-semibold text-center">
                  Gotowy?
                  <br />
                  Zacznijmy!
                </p>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Audio Player Section */}
      {!showInstructions && (
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">
                  Praktyka uśmiechania organów
                </h2>
                <p className="text-gray-600">
                  Usiądź wygodnie, naciśnij nagrywanie na telefonie, zamknij oczy
                  i kliknij Play
                </p>
              </div>

              {/* Audio Player UI */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl mb-6">
                <div className="flex flex-col items-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlayPause}
                    className="w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white shadow-2xl hover:shadow-3xl transition-shadow"
                  >
                    {isPlaying ? <Pause size={40} /> : <Play size={40} className="ml-1" />}
                  </motion.button>

                  <div className="w-full">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Guided meditation</span>
                      <span>~5 min</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                        initial={{ width: "0%" }}
                        animate={{ width: isPlaying ? "100%" : "0%" }}
                        transition={{ duration: 300, ease: "linear" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hidden audio element - W realnej aplikacji tutaj byby plik MP3 */}
                <audio
                  ref={audioRef}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >
                  {/* W produkcji tutaj byłby link do pliku MP3 */}
                  {/* <source src="/audio/uśmiechanie-organow.mp3" type="audio/mpeg" /> */}
                </audio>
              </div>

              {/* Instructions reminder */}
              <div className="bg-purple-50 p-6 rounded-xl border-l-4 border-purple-600">
                <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  <Camera size={20} />
                  Pamiętaj o nagraniu!
                </h3>
                <p className="text-sm text-purple-800">
                  Przed rozpoczęciem włącz kamerę frontową i naciśnij nagrywanie.
                  Po zakończeniu zobaczysz jak zmieniła się Twoja twarz - to
                  magiczny moment! 📹✨
                </p>
              </div>

              {/* Note about MP3 */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 italic">
                  💡 W pełnej wersji tutaj znajduje się profesjonalnie nagrane
                  audio z guided meditation poprowadzone przez doświadczonego
                  praktyka.
                </p>
              </div>

              {/* Back button */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowInstructions(true)}
                  className="text-purple-600 hover:text-purple-700 font-semibold"
                >
                  ← Wróć do instrukcji
                </button>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">Co zyskujesz?</h2>
            <p className="text-lg text-gray-600">
              Efekty natychmiastowe i długoterminowe
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Natychmiastowy spokój",
                description:
                  "Już po pierwszej praktyce poczujesz głębokie rozluźnienie i wewnętrzny pokój",
                icon: "🧘",
              },
              {
                title: "Widoczna zmiana twarzy",
                description:
                  "Twoja twarz się rozluźnia, napięcie znika, pojawia się naturalny blask",
                icon: "✨",
              },
              {
                title: "Harmonizacja organów",
                description:
                  "Organy otrzymują energię wdzięczności i zaczynają funkcjonować harmonijnie",
                icon: "💚",
              },
              {
                title: "Redukcja stresu",
                description:
                  "Aktywizacja układu przywspółczulnego - naturalny mechanizm relaksacji",
                icon: "🌊",
              },
              {
                title: "Wzrost energii",
                description:
                  "Poczujesz przypływ życiowej energii i vitalności",
                icon: "⚡",
              },
              {
                title: "Głęboka wdzięczność",
                description:
                  "Połączenie z ciałem i poczucie wdzięczności za jego pracę",
                icon: "🙏",
              },
            ].map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="text-4xl mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">
                  {benefit.title}
                </h3>
                <p className="text-gray-600">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Zobacz transformację na własne oczy
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Już po jednej sesji zobaczysz różnicę. Twoja twarz, Twoja energia,
              Twoje samopoczucie - wszystko się zmienia w 5 minut.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowInstructions(false);
                window.scrollTo({ top: 400, behavior: "smooth" });
              }}
              className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow text-lg"
            >
              Rozpocznij teraz
            </motion.button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}