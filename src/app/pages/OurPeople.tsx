import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, X } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface Person {
  name: string;
  role: string;
  description: string;
  image: string;
  story: string;
}

const people: Person[] = [
  {
    name: "Karol",
    role: "Trener personalny",
    description: "Pokazuje, \u017ce trening mo\u017ce by\u0107 jednocze\u015bnie prac\u0119 z cia\u0142em i spokojem g\u0142owy.",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    story: "Przez lata budowa\u0142 form\u0119 tylko dla wyniku. Z czasem odkry\u0142, \u017ce najwi\u0119ksza zmiana dzieje si\u0119 wtedy, gdy ruch daje te\u017c kontakt ze sob\u0105.",
  },
  {
    name: "Asia",
    role: "\u015awiadome \u017cycie",
    description: "Prowadzi ludzi z chaosu do wi\u0119kszej lekko\u015bci, rytmu i uwa\u017cno\u015bci na co dzie\u0144.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    story: "Zrezygnowa\u0142a z \u017cycia w ci\u0105g\u0142ym biegu i zacz\u0119\u0142a budowa\u0107 codzienno\u015b\u0107 opart\u0105 na oddechu, prostocie i dobrym tempie dla cia\u0142a.",
  },
  {
    name: "Marcin",
    role: "Kwantowy przedsi\u0119biorca",
    description: "\u0141\u0105czy biznes, sens i sprawczo\u015b\u0107 bez odcinania si\u0119 od w\u0142asnych warto\u015bci.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    story: "Prowadzi\u0142 biznes jak automat. Dzi\u015b uczy, jak tworzy\u0107 projekty, kt\u00f3re dowo\u017c\u0105 wynik i jednocze\u015bnie nie kosztuj\u0105 cz\u0142owieka utraty siebie.",
  },
  {
    name: "Jacek",
    role: "\u015awiadomo\u015b\u0107 siebie",
    description: "Pracuje z lud\u017ami, kt\u00f3rzy chc\u0105 odzyska\u0107 kierunek i wr\u00f3ci\u0107 do w\u0142asnego centrum.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    story: "Po latach szukania odpowiedzi na zewn\u0105trz zrozumia\u0142, \u017ce najwa\u017cniejsza podr\u00f3\u017c prowadzi do \u015brodka. Dzi\u015b pomaga innym zrobi\u0107 ten sam krok.",
  },
];

export function OurPeople() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  return (
    <div className="w-full">
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-8 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
            >
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Nasi ludzie
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mx-auto max-w-3xl text-xl leading-relaxed text-gray-700 sm:text-2xl"
            >
              Prawdziwe historie ludzi, kt\u00f3rzy zaufali zmianie i zbudowali w\u0142asn\u0105 drog\u0105 po swojemu.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {people.map((person, index) => (
              <motion.div
                key={person.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative"
              >
                <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 shadow-lg transition-shadow duration-300 hover:shadow-2xl">
                  <ImageWithFallback
                    src={person.image}
                    alt={person.name}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <button
                    onClick={() => setSelectedPerson(person)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl"
                    >
                      <Play className="text-purple-600" size={28} fill="currentColor" />
                    </motion.div>
                  </button>

                  <div className="absolute bottom-0 left-0 right-0 translate-y-2 p-6 transition-transform duration-300 group-hover:translate-y-0">
                    <div className="rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur-sm">
                      <h3 className="mb-1 text-xl font-bold text-gray-800">{person.name}</h3>
                      <p className="mb-2 text-sm font-semibold text-purple-600">{person.role}</p>
                      <p className="text-sm leading-relaxed text-gray-600">{person.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedPerson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setSelectedPerson(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setSelectedPerson(null)}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg transition-colors hover:bg-white"
              >
                <X size={20} className="text-gray-800" />
              </button>

              <div className="p-8 sm:p-12">
                <div className="mb-8 flex items-start gap-6">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl shadow-lg">
                    <ImageWithFallback
                      src={selectedPerson.image}
                      alt={selectedPerson.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="mb-2 text-3xl font-bold text-gray-800">{selectedPerson.name}</h2>
                    <p className="text-lg font-semibold text-purple-600">{selectedPerson.role}</p>
                  </div>
                </div>

                <div className="mb-8 aspect-video rounded-2xl bg-gradient-to-br from-purple-200 to-pink-200 shadow-lg">
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <Play size={48} className="mx-auto mb-4 text-purple-600" />
                      <p className="font-medium text-gray-600">Wideo historii pojawi\u0105 si\u0119 tutaj p\u00f3\u017aniej</p>
                      <p className="mt-2 text-sm text-gray-500">Na razie pokazujemy wersj\u0119 tekstow\u0105</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border-l-4 border-purple-600 bg-white p-6 shadow-lg">
                  <h3 className="mb-4 text-xl font-bold text-gray-800">Kr\u00f3tka historia</h3>
                  <p className="text-lg leading-relaxed text-gray-700">{selectedPerson.story}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
