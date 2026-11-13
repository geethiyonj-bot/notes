          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}

const bibleVerses = [
  { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed.", reference: "JOSHUA 1:9" },
  { text: "I can do all things through Christ which strengtheneth me.", reference: "PHILIPPIANS 4:13" },
  { text: "The Lord is my shepherd; I shall not want.", reference: "PSALM 23:1" },
  { text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.", reference: "PROVERBS 3:5" },
  { text: "With God all things are possible.", reference: "MATTHEW 19:26" },
  { text: "Thy word is a lamp unto my feet, and a light unto my path.", reference: "PSALM 119:105" },
  { text: "The Lord is my light and my salvation; whom shall I fear?", reference: "PSALM 27:1" },
  { text: "Let all that ye do be done in love.", reference: "1 CORINTHIANS 16:14" },
  { text: "For we walk by faith, not by sight.", reference: "2 CORINTHIANS 5:7" },
  { text: "Commit thy works unto the Lord, and thy thoughts shall be established.", reference: "PROVERBS 16:3" }
];

function BibleVerseTicker() {
  const [verseIndex, setVerseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVerseIndex((current) => (current + 1) % bibleVerses.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, []);

  const verse = bibleVerses[verseIndex];

  return (
    <section className="verse-ribbon" aria-live="polite" aria-label="Continuously changing Bible verses">
      <div className="verse-cross" aria-hidden="true">✝</div>
      <div className="verse-marquee-window">
        <motion.div
          key={verseIndex}
          className="verse-marquee-track"
          initial={{ x: "35%", opacity: 0.25 }}
          animate={{ x: ["35%", "-100%"], opacity: 1 }}
          transition={{ duration: 6.4, ease: "linear" }}
        >
          <span>“{verse.text}”</span>
          <b>– {verse.reference}</b>
          <i className="verse-separator">✦</i>
          <span>“{bibleVerses[(verseIndex + 1) % bibleVerses.length].text}”</span>
          <b>– {bibleVerses[(verseIndex + 1) % bibleVerses.length].reference}</b>
        </motion.div>
      </div>
      <div className="verse-arrows" aria-hidden="true">»</div>
    </section>
  );
}

function AdSlot({ slot, label }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT;

  useEffect(() => {
    if (!client || typeof window === "undefined") return;

    let script = document.querySelector("script[data-vimal-ads]");

    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.vimalAds = "true";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(script);
    }

    if (slot) {
      const push = () => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (_) {}
      };

      if (script.dataset.loaded === "true") {
        push();
      } else {
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "true";
            push();
          },
          { once: true }
        );
      }
    }
  }, [client, slot]);

  return (
    <div className="ad-wrap">
      <div className="ad-label">{label}</div>

      {client && slot ? (
        <ins
          className="adsbygoogle ad-unit"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="ad-placeholder">
          <b>VIMAL College Hub · Sponsored space</b>
          <span>
            Advertisement space — connect an approved ad account or contact us
            for sponsorship.
          </span>
        </div>
      )}
    </div>
  );
}

function AuthModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();

    if (!supabase) {
      setMessage(
        "Authentication is not configured. Add the Supabase public environment variables in Vercel."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (!sent) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true }
        });

        if (error) throw error;

        setSent(true);
        setMessage(
          "A sign-in code has been sent to your email. Check your inbox and spam folder."
        );
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "email"
        });
