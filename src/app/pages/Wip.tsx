import { motion } from "motion/react";

export function Wip() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="inline-block px-6 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full mb-4 font-semibold"
            >
              🚧 WORK IN PROGRESS 🚧
            </motion.div>
            <h1 className="text-4xl font-bold mb-4">
              Pomysły i plany rozwoju{" "}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                odjebao.me
              </span>
            </h1>
            <p className="text-gray-600">
              Surowe notatki i koncepcje na przyszłość
            </p>
          </div>

          {/* Raw Text Content */}
          <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
{`📚 KSIĄŻKA: "Jak mi odjeba*o" - Emanowiczów dwóch. Rozmowa ojca z synem.

Koncept: Dialog ojca z synem, gdzie syn opowiada o swoich świadomych wyborach 
(medytacja, zdrowe odżywianie, przytulanie drzew, rozwój osobisty), 
a ojciec reaguje klasycznie: "Oj synek synek, pojebało cię?" 😂

Format: Humorystyczna rozmowa pokazująca kontrast pokoleń i światopoglądów.
Syn: "Tato, byłem dziś w lesie, przytuliłem brzozę, poczułem energię ziemi..."
Ojciec: "Oj synek synek, pojebało cię?"

HISTORIA: Odzyskanie relacji z ojcem po 15 latach
- Świadomy wybór odbudowy relacji
- Zrozumienie procesu transformacji
- Urodziny które mi zorganizowali
- Wsparcie które ojciec okazał
Piękna historia o tym jak świadomość i otwartość może naprawić nawet 
najdłuższe zerwane relacje 💜

---

📚 KSIĄŻKI - FUNDAMENT I REKOMENDACJE

Książki wspólne - pisane razem z ekspertami społeczności
Co polecamy zawsze na początek?
→ Książka Dariusza - "Od czego zacząć?" 
   Fundament świadomego życia dla początkujących

Pomysł: PAKIET KSIĄŻEK STARTOWYCH
- Książka Dariusza (fundament)
- Szkolenia online do każdej książki
- Materiały dodatkowe, ćwiczenia

---

Można tam zainstlaować apliakcję posłuchaj siebie, która będzie nasłuchiwać, 
co mówisz w ciągu dnia a następne analizować ten tekst na bierząco, możę da się zrobić service do nagrywania 
dźwieku z mikrofonu.

Zropbić Marcina, Jacka, Dariusza, Asie Piasek, Beate

Zrobić sekcje biznesowe, dla beaty, asi, konrada,

dac historie ludzi ktorym odjeba*o, tomek zabawa moze przedstawiciesltwo hjandlowe, beata kapcewisz kawiearnia, 
ja kierowca tira marcin przedstawiwciel cpnu, klaudia ktora rzuycialo fryzjrestrwo, dariusz też, dodać serwer diskord do dołąćzenia na któym będą pozytywne treści, sekcja wyjazdów

społecznośc emadnar może filmiki z kajaków pokazane co i jak?

No nie wiem czy to za bardzo nie będzie wszsytko pokazane na raz. 

o mnie, moja historia, jak mi odjeba*o, zmiana z tir, kupiłem drukarke, a 3 miesiące robie poźniej,czynniki twórcze i te rzeczy etc etp. 

Można dać tak:
Karol, trener personalny
Paweł Węgier, trener spokoju
Patrycja Termin, ciało tańcze
Natalia, ketony, zdrowie odzywianie
Beatka, tego śmego
Dać dla każdego z nich filmik
Konrada damy jako duo, ale że ja będe pod nim i on będzie rejestrował pode mnie np albo coś.
Dodaj tam może jacek,

Fajne takie, tylko każdy by musiał nagrać filmik
Ola trenowanie konii i moiscom
zajebiste.
MOże być ten chłop co jeździ na rowerze organizuje wyjazdy i tak dalej. 

Poznaj nas, zapisz się na szkolenie tego lub tamtego, dominik, samochody i klub we wrocawiu throwing axe.

No w chuj tego jest, można zrobić wszystkie cuda świata, tylko jak teraz dla mnie na tym zarobić pieniążek jakoś?

Zrobić opcję sprzedawania tam prodtuków duo, dołązenia do duo, i produktów young living też.

Aromaterapia.`}
            </pre>
          </div>

          {/* Footer note */}
          <div className="mt-8 p-4 bg-purple-50 rounded-xl">
            <p className="text-sm text-purple-600 text-center">
              💡 <strong>Uwaga:</strong> To są surowe pomysły i notatki do dalszej
              pracy. Nie wszystko musi być zrealizowane od razu!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}