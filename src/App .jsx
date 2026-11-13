
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  Search, BookOpen, FileText, FlaskConical, GraduationCap,
  ArrowUpRight, Sparkles, Menu, X, UploadCloud, LibraryBig,
  Layers3, Command, CheckCircle2, BookMarked, Crown, LogIn,
  LogOut, Mail, BadgeIndianRupee, Home, ShieldCheck, Globe2, UserRound,
  Files, Columns2, Maximize2, Minimize2, FileX2, Plus, ArrowLeft
} from "lucide-react";

const departments = ["CSE", "IT", "AI & DS", "AI & ML", "ECE", "EEE", "Mechanical", "Civil"];

const resourceTypes = [
  "All resources",
  "CIE question papers",
  "Semester question papers",
  "Lab practical questions",
  "Lab manuals",
  "Study materials"
];

const sems = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8] };

const supabase =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
    : null;

export default function App() {
  const [department, setDepartment] = useState("CSE");
  const [year, setYear] = useState("2");
  const [semester, setSemester] = useState("4");
  const [type, setType] = useState("All resources");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [admin, setAdmin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  async function refreshAccount(currentSession = session) {
    if (!currentSession?.access_token) {
      setAccount(null);
      return;
    }

    try {
      const response = await fetch("/api/account", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAccount(data);
      } else {
        console.error("Account error:", data.error);
      }
    } catch (err) {
      console.error("Could not refresh account:", err);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setAccountLoading(false);
      return;
    }

    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;

      setSession(data.session);

      if (data.session) {
        await refreshAccount(data.session);
      }

      if (alive) setAccountLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);

      if (next) {
        setTimeout(() => refreshAccount(next), 0);
      } else {
        setAccount(null);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function search(e) {
    e?.preventDefault();

    if (query.trim().length < 2) {
      setError("Enter at least two characters.");
      return;
    }

    if (!session) {
      setAuthOpen(true);
      setError("Sign in with your email to use academic search.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);

    const params = new URLSearchParams({
      q: query.trim(),
      department,
      year,
      semester
    });

    if (type !== "All resources") {
      params.set("type", type);
    }

    try {
      const response = await fetch(`/api/search?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (response.status === 402) {
        setResults([]);
        setError(data.error || "Your free daily searches are finished.");
        await refreshAccount();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setResults(data.results || []);
      await refreshAccount();

      if (!data.results?.length) {
        setError(
          "No matches found. Ask your administrator to upload the relevant PDFs."
        );
      }
    } catch (err) {
      setResults([]);
      setError(
        err.message || "Search service unavailable. Check deployment configuration."
      );
    } finally {
      setLoading(false);
    }
  }

  async function buyMonthlyPass() {
    if (!session) {
      setAuthOpen(true);
      return;
    }

    if (!window.Razorpay) {
      setPayMessage(
        "Payment checkout did not load. Refresh the page and try again."
      );
      return;
    }

    setPaying(true);
    setPayMessage("");

    try {
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: "{}"
      });

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.error || "Could not start payment.");
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "VIMAL College Hub",
        description: "30-day unlimited academic search pass",
        order_id: order.orderId,
        prefill: {
          email: session.user.email
        },
        theme: {
          color: "#b18d4c"
        },

        handler: async (response) => {
          try {
            const verify = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(response)
            });

            const result = await verify.json();

            if (!verify.ok) {
              throw new Error(result.error || "Payment verification failed.");
            }

            setPayMessage(
              "Payment verified. Your unlimited search pass is active for one month."
            );

            await refreshAccount();
          } catch (err) {
            setPayMessage(
              err.message ||
                "Payment verification is pending. Please contact support with your payment ID."
            );
          }
        },

        modal: {
          ondismiss: () => {
            setPayMessage(
              "Payment window closed. No membership was activated unless payment was completed and verified."
            );
          }
        }
      });

      checkout.on("payment.failed", (response) => {
        setPayMessage(
          response.error?.description || "Payment failed. Please try again."
        );
      });

      checkout.open();
    } catch (err) {
      setPayMessage(err.message || "Payment could not be started.");
    } finally {
      setPaying(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setResults([]);
    setSearched(false);
    setPayMessage("");
  }

  const freeRemaining = account?.remaining ?? 0;
  const rawStudentName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split("@")[0] ||
    "Student";
  const studentName = String(rawStudentName)
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="app">
      <header className="nav vimal-nav" id="top">
        <a className="brand vimal-brand" href="#top" aria-label="VIMAL HUB home">
          <span className="brandicon"><BookOpen size={31} /></span>
          <span>
            VIMAL HUB
            <small>ACADEMIC PORTAL FOR COLLEGE STUDENTS</small>
          </span>
        </a>

        <button className="hamb" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>
          {menu ? <X /> : <Menu />}
        </button>

        <nav className={menu ? "links show vimal-links" : "links vimal-links"}>
          <a className="nav-home" href="#top" onClick={() => setMenu(false)}><Home size={17} /> Home</a>
          <a href="#explore" onClick={() => setMenu(false)}><Search size={17} /> Search</a>
          <button onClick={() => { setAdmin(true); setMenu(false); }}><UploadCloud size={17} /> Upload</button>
          <a className="nav-premium" href="#membership" onClick={() => setMenu(false)}><Crown size={18} /> Premium</a>
          <button onClick={() => { setAdmin(true); setMenu(false); }}><ShieldCheck size={17} /> Admin</button>
        </nav>

        <button
          className="student-gmail"
          onClick={() => session ? signOut() : setAuthOpen(true)}
          title={session ? "Sign out" : "Student sign in"}
        >
          <span className="google-g">G</span>
          <span>{session ? studentName : "Student sign in"}</span>
          <span className="gmail-chevron">⌄</span>
        </button>
      </header>

      <main>
        {viewerOpen ? (
          <MultiPdfViewer
            session={session}
            department={department}
            setDepartment={setDepartment}
            year={year}
            setYear={setYear}
            semester={semester}
            setSemester={setSemester}
            type={type}
            setType={setType}
            onBack={() => setViewerOpen(false)}
            onSignIn={() => setAuthOpen(true)}
          />
        ) : (
        <>
        <section className="hero vimal-hero">
          <div className="hero-slogan">
            <div className="slogan-copy">
              <h1>Learn <span>•</span> <em>Explore</em> <span>•</span> Excel</h1>
              <p>Knowledge is Power... and with God, you can achieve more.</p>
            </div>
            <div className="slogan-globe" aria-hidden="true"><Globe2 /></div>
          </div>

          <BibleVerseTicker />

          <div className="welcome-founder-grid">
            <section className="welcome-panel">
              <div className="welcome-avatar"><UserRound size={58} /></div>
              <div className="welcome-copy">
                <span className="student-label"><GraduationCap size={16} /> STUDENT PORTAL</span>
                <h2>Welcome back, <strong>{session ? studentName : "Student"}!</strong></h2>
                <h3>Your learning journey continues...</h3>
                <p>Discover knowledge. Explore resources. Achieve more.</p>
              </div>
            </section>

            <section className="founder-showcase" aria-label="Founder Vimal">
              <div className="founder-copy">
                <span className="founder-kicker">FOUNDER</span>
                <strong className="founder-name">VIMAL</strong>
                <p>“Dream Big... Learn More...<br />Achieve Higher...”</p>
                <span className="founder-signature">– Vimal</span>
              </div>
              <img src="/founder-portrait.png" alt="Founder Vimal" />
            </section>
          </div>

          <div className="quick-actions">
            <a className="quick-card quick-search" href="#explore">
              <Search size={42} />
              <span><b>Search Content</b><small>Find Now →</small></span>
            </a>
            <button className="quick-card quick-upload" onClick={() => setAdmin(true)}>
              <UploadCloud size={44} />
              <span><b>Upload PDFs</b><small>Upload →</small></span>
            </button>
            <a className="quick-card quick-premium" href="#membership">
              <Crown size={44} />
              <span><b>Premium Access</b><small>Get Access →</small></span>
            </a>
            <button className="quick-card quick-admin" onClick={() => setAdmin(true)}>
              <ShieldCheck size={44} />
              <span><b>Admin Panel</b><small>Login →</small></span>
            </button>
            <button
              className="quick-card quick-multiview"
              onClick={() => { setViewerOpen(true); setMenu(false); }}
            >
              <Files size={44} />
              <span><b>Multi PDF Viewer</b><small>Open multiple PDFs →</small></span>
            </button>
          </div>
        </section>

        <section className="section account-area" id="membership" aria-label="Student account and membership">
          <div className="account-card">
            <div>
              <div className="eyebrow dark">STUDENT SEARCH PASS</div>

              <h3>
                {session
                  ? `Welcome back, ${studentName}!`
                  : "Sign in to start searching"}
              </h3>

              <p>
                {session
                  ? accountLoading
                    ? "Loading your plan…"
                    : account?.isPremium
                    ? `Unlimited searches active until ${new Date(
                        account.expiresAt
                      ).toLocaleDateString("en-IN")}.`
                    : `Free plan: ${freeRemaining} of ${
                        account?.freeLimit ?? 10
                      } searches remaining today.`
                  : "Create a free account with your email. Free members get 10 searches each day."}
              </p>
            </div>

            <div className="pass-actions">
              {session ? (
                <>
                  <span
                    className={
                      account?.isPremium
                        ? "plan-pill active"
                        : "plan-pill"
                    }
                  >
                    {account?.isPremium ? (
                      <>
                        <Crown size={14} /> UNLIMITED
                      </>
                    ) : (
                      "FREE PLAN"
                    )}
                  </span>

                  {!account?.isPremium && (
                    <button
                      className="buy-button"
                      onClick={buyMonthlyPass}
                      disabled={paying}
                    >
                      <BadgeIndianRupee size={16} />
                      {paying
                        ? "Preparing…"
                        : "Get 1 month unlimited · ₹10"}
                    </button>
                  )}

                  <button className="text-button" onClick={signOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  className="buy-button"
                  onClick={() => setAuthOpen(true)}
                >
                  <Mail size={16} /> Student sign in
                </button>
              )}
            </div>
          </div>

          {payMessage && <div className="notice">{payMessage}</div>}
        </section>

        <AdSlot
          slot={import.meta.env.VITE_ADSENSE_SLOT_TOP}
          label="Advertisement"
        />

        <section className="search section" id="explore">
          <div className="section-head">
            <div>
              <div className="eyebrow dark">DISCOVER YOUR MATERIAL</div>
              <h2>
                What are you <em>looking for?</em>
              </h2>
              <p>
                Search by concept, question, subject or keyword. We'll locate
                the unit and page.
              </p>
            </div>
            <div className="searchbadge"><Search /></div>
          </div>

          <form className="panel" onSubmit={search}>
            <div className="query">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “AVL tree rotation”, “normalization”, “pipelining”…"
              />
              <kbd>ENTER ↵</kbd>
            </div>

            <div className="filters">
              <label>
                <small>DEPARTMENT</small>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {departments.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                <small>YEAR</small>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setSemester(String(sems[e.target.value][0]));
                  }}
                >
                  {[1, 2, 3, 4].map((x) => (
                    <option key={x} value={x}>Year {x}</option>
                  ))}
                </select>
              </label>

              <label>
                <small>SEMESTER</small>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  {sems[year].map((x) => (
                    <option key={x} value={x}>Semester {x}</option>
                  ))}
                </select>
              </label>

              <label className="type">
                <small>RESOURCE TYPE</small>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {resourceTypes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <button className="searchbtn" disabled={loading}>
                <Search size={16} />
                {loading ? "Searching…" : "Search library"}
              </button>
            </div>
          </form>

          <div className="hint">
            <Sparkles size={14} />
            <span>
              <b>Smart tip:</b> You don't need to select a unit. Search across
              Units 1–5 and we'll find where the topic appears.{" "}
              {!session &&
                "Sign in first; free accounts receive 10 searches daily."}
            </span>
          </div>

          {error && (
            <div className="notice">
              {error}
              {error.includes("free daily") && (
                <button className="inline-upgrade" onClick={buyMonthlyPass}>
                  Unlock unlimited for ₹10
                </button>
              )}
            </div>
          )}

          {searched && results.length > 0 && (
            <div className="results">
              <div className="resulthead">
                <div>
                  <div className="eyebrow dark">SEARCH INTELLIGENCE</div>
                  <h3>{results.length} matching results</h3>
                </div>
                <span>For “{query}”</span>
              </div>

              {results.map((r, i) => (
                <motion.article
                  className="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  key={`${r.id}-${r.page}`}
                >
                  <div className="pdficon">
                    <FileText />
                    <small>PDF</small>
                  </div>

                  <div className="resultbody">
                    <div className="tags">
                      <span>{r.department}</span>
                      <span>YEAR {r.year}</span>
                      <span>SEM {r.semester}</span>
                      {r.unit && <b>UNIT {r.unit}</b>}
                    </div>

                    <h4>{r.title}</h4>
                    <p>{r.excerpt}</p>

                    <div className="meta">
                      <span><BookOpen />{r.subject}</span>
                      <span><Layers3 />{r.resourceType}</span>
                      <span><FileText />Page {r.page}</span>
                    </div>
                  </div>

                  <button
                    className="open"
                    onClick={() =>
                      r.pdfUrl
                        ? window.open(
                            `${r.pdfUrl}#page=${r.page}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        : null
                    }
                  >
                    Open PDF <ArrowUpRight size={15} />
                  </button>
                </motion.article>
              ))}
            </div>
          )}

          <AdSlot
            slot={import.meta.env.VITE_ADSENSE_SLOT_RESULTS}
            label="Sponsored learning resources"
          />
        </section>

        <section className="section feature-section" id="features">
          <div className="eyebrow dark">YOUR COMPLETE STUDY SPACE</div>
          <h2>
            Everything for your <em>semester.</em>
          </h2>
          <p className="sub">Organised resources, one connected library.</p>

          <div className="featuregrid">
            <Feature
              icon={<FileText />}
              n="01"
              title="CIE question papers"
              desc="Previous internal assessment papers organised by subject and semester."
            />
            <Feature
              icon={<GraduationCap />}
              n="02"
              title="Semester papers"
              desc="Previous university examination papers to practise with confidence."
            />
            <Feature
              icon={<FlaskConical />}
              n="03"
              title="Lab & practicals"
              desc="Experiments, viva questions, practical exercises and lab manuals."
            />
            <Feature
              icon={<BookMarked />}
              n="04"
              title="Unit-wise materials"
              desc="Notes and study PDFs across all five units with concept-level search."
            />
          </div>
        </section>

        <section className="how" id="how">
          <div className="howinner section">
            <div>
              <div className="eyebrow">BEYOND FILE NAMES</div>
              <h2>
                Search the <em>knowledge</em>
                <br />
                inside every PDF.
              </h2>
              <p>
                Each uploaded PDF is processed page by page. Search remembers
                the content and exact location, so a topic in Unit 4 can be
                found without opening five separate files.
              </p>
              <a className="primary" href="#explore">
                Try topic search <ArrowUpRight size={17} />
              </a>
            </div>

            <div className="steps">
              {[
                ["01", "Upload", "Admin adds the PDF and academic details."],
                ["02", "Extract & index", "The backend extracts and indexes each page."],
                ["03", "Discover", "Students search a concept and see matching pages."],
                ["04", "Open & study", "Open the original PDF directly at the matching page."]
              ].map(([n, t, d]) => (
                <div className="step" key={n}>
                  <span>{n}</span>
                  <div>
                    <b>{t}</b>
                    <small>{d}</small>
                  </div>
                  <CheckCircle2 />
                </div>
              ))}

              <div className="stamp">
                <Command /> CONTENT-AWARE SEARCH
              </div>
            </div>
          </div>
        </section>
        </>
        )}
      </main>

      <footer>
        <div className="brand">
          <span className="brandicon"><LibraryBig /></span>
          VIMAL<span className="gold"> HUB</span>
        </div>
        <p>
          Created by <b>Vimal</b> · A better way to find what you need to learn.
        </p>
        <small>
          © {new Date().getFullYear()} VIMAL HUB · ACADEMIC PORTAL ·{" "}
          <a href="/privacy.html">Privacy</a> ·{" "}
          <a href="/terms.html">Terms</a>
        </small>
      </footer>

      {admin && <Admin onClose={() => setAdmin(false)} />}
      {authOpen && (
        <AuthModal
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

        if (error) throw error;

        onSuccess();
      }
    } catch (err) {
      setMessage(err.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal auth-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose}>
          <X />
        </button>

        <div className="eyebrow dark">STUDENT ACCOUNT</div>

        <h2>{sent ? "Enter your email code" : "Sign in to VIMAL Hub"}</h2>

        <p>
          Use your email to save your free daily search allowance and activate
          your monthly pass securely.
        </p>

        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={sent}
              placeholder="you@example.com"
            />
          </label>

          {sent && (
            <label>
              6-digit verification code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={8}
                placeholder="Enter code from email"
              />
            </label>
          )}

          <button className="searchbtn full" disabled={busy}>
            {busy
              ? "Please wait…"
              : sent
              ? "Verify & sign in"
              : "Send sign-in code"}
          </button>

          {message && <div className="notice">{message}</div>}

          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setOtp("");
                setMessage("");
              }}
            >
              Change email address
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function Feature({ icon, n, title, desc }) {
  return (
    <motion.div className="feature" whileHover={{ y: -5 }}>
      <div className="featuretop">
        <span>{icon}</span>
        {n}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <ArrowUpRight className="featurearrow" />
    </motion.div>
  );
}

/* UPDATED ADMIN PDF UPLOAD COMPONENT */

function Admin({ onClose }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState(null);

  const [f, setF] = useState({
    title: "",
    department: "CSE",
    year: "2",
    semester: "4",
    unit: "1",
    subject: "",
    subjectCode: "",
    resourceType: "Study materials"
  });

  const upd = (e) => {
    setF({
      ...f,
      [e.target.name]: e.target.value
    });
  };

  async function submit(e) {
    e.preventDefault();

    setStatus("");

    if (!key.trim()) {
      setStatus("Enter your Admin access key.");
      return;
    }

    if (!pdf) {
      setStatus("Choose a PDF first.");
      return;
    }

    const isPdf =
      pdf.type === "application/pdf" ||
      pdf.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setStatus("Only PDF files are allowed.");
      return;
    }

    // Keep the upload below Vercel's request-body limit.
    const MAX_SIZE = 3 * 1024 * 1024;

    if (pdf.size > MAX_SIZE) {
      setStatus(
        "This PDF is larger than 3 MB. Please compress it before uploading."
      );
      return;
    }

    setBusy(true);

    const fd = new FormData();

    Object.entries(f).forEach(([k, v]) => {
      fd.append(k, v);
    });

    fd.append("pdf", pdf);

    try {
      const response = await fetch("/api/admin-upload", {
        method: "POST",
        headers: {
          "x-admin-key": key.trim()
        },
        body: fd
      });

      // Read text first so non-JSON server errors do not crash the frontend.
      const responseText = await response.text();

      let data;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        const message = responseText.trim().slice(0, 500);

        throw new Error(
          `Server returned a non-JSON response (HTTP ${response.status}). ${
            message || "No response details were provided."
          }`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Upload failed with HTTP ${response.status}.`
        );
      }

      if (data.success === false) {
        throw new Error(data.error || "The server could not upload this PDF.");
      }

      const pages =
        data.indexedPages ??
        data.pagesIndexed ??
        data.pageCount ??
        "unknown";

      setStatus(
        `Upload successful. Indexed PDF pages: ${pages}.`
      );

      setPdf(null);

      const fileInput = document.getElementById("admin-pdf-input");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setStatus(err.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose}>
          <X />
        </button>

        <div className="eyebrow dark">CONTENT MANAGEMENT</div>

        <h2>Upload a resource</h2>

        <p>
          PDF text is indexed page-by-page for student concept search.
        </p>

        <form onSubmit={submit}>
          <label>
            Admin access key
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="Private key from Vercel environment variables"
              autoComplete="new-password"
            />
          </label>

          <label>
            Resource title
            <input
              name="title"
              value={f.title}
              onChange={upd}
              required
              placeholder="Data Structures — Unit 4"
            />
          </label>

          <div className="adminrow">
            <label>
              Department
              <select
                name="department"
                value={f.department}
                onChange={upd}
              >
                {departments.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label>
              Year
              <select
                name="year"
                value={f.year}
                onChange={upd}
              >
                {[1, 2, 3, 4].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label>
              Semester
              <select
                name="semester"
                value={f.semester}
                onChange={upd}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label>
              Unit
              <select
                name="unit"
                value={f.unit}
                onChange={upd}
              >
                <option value="">No unit</option>
                {[1, 2, 3, 4, 5].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Subject
            <input
              name="subject"
              value={f.subject}
              onChange={upd}
              required
              placeholder="Data Structures"
            />
          </label>

          <label>
            Subject code
            <input
              name="subjectCode"
              value={f.subjectCode}
              onChange={upd}
              placeholder="Optional"
            />
          </label>

          <label>
            Resource type
            <select
              name="resourceType"
              value={f.resourceType}
              onChange={upd}
            >
              {resourceTypes.slice(1).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>

          <label className="drop">
            <UploadCloud />
            <b>{pdf ? pdf.name : "Choose PDF document"}</b>
            <small>PDF only · maximum 3 MB</small>

            <input
              id="admin-pdf-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                setPdf(e.target.files?.[0] || null);
                setStatus("");
              }}
            />
          </label>

          <button className="searchbtn full" disabled={busy}>
            {busy ? "Uploading and indexing…" : "Upload & index PDF"}
          </button>

          {status && (
            <div className="notice" role="status">
              {status}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}


/*
 * Multi PDF Viewer
 * Uses the existing authenticated /api/search endpoint and its existing
 * department/year/semester/resource filters. Search results can be opened
 * as independent document panes. A true no-download policy also requires
 * private storage and a server-side PDF streaming endpoint.
 */
function MultiPdfViewer({
  session, department, setDepartment, year, setYear,
  semester, setSemester, type, setType, onBack, onSignIn
}) {
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [maximizedId, setMaximizedId] = useState(null);

  async function findDocuments(e) {
    e?.preventDefault();
    if (term.trim().length < 2) {
      setMessage("Enter at least two characters to search the academic library.");
      return;
    }
    if (!session?.access_token) {
      setMessage("Sign in with your student account to search and open PDFs.");
      return;
    }

    setBusy(true);
    setMessage("");
    const params = new URLSearchParams({
      q: term.trim(), department, year, semester
    });
    if (type !== "All resources") params.set("type", type);

    try {
      const response = await fetch(`/api/search?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await response.json();

      if (response.status === 402) {
        setMatches([]);
        setMessage(data.error || "Your free daily searches are finished.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setMatches(data.results || []);
      if (!data.results?.length) setMessage("No matching PDFs found. Try another keyword or filter.");
    } catch (err) {
      setMessage(err.message || "Could not search the academic library.");
    } finally {
      setBusy(false);
    }
  }

  function addDocument(result) {
    if (!result.pdfUrl) {
      setMessage("This result does not include a PDF viewing link. Ask the administrator to check its file URL.");
      return;
    }
    const key = `${result.id}-${result.page}-${result.pdfUrl}`;
    if (documents.some((doc) => doc.key === key)) {
      setActiveId(key);
      return;
    }
    const next = { ...result, key };
    setDocuments((current) => [...current, next]);
    setActiveId(key);
    setMaximizedId(null);
  }

  function removeDocument(key) {
    setDocuments((current) => current.filter((doc) => doc.key !== key));
    if (activeId === key) {
      const remaining = documents.filter((doc) => doc.key !== key);
      setActiveId(remaining.at(-1)?.key || null);
    }
    if (maximizedId === key) setMaximizedId(null);
  }

  const visibleDocs = maximizedId
    ? documents.filter((doc) => doc.key === maximizedId)
    : documents;

  const fieldStyle = {
    width: "100%", minWidth: 0, padding: "12px 13px", borderRadius: 10,
    border: "1px solid rgba(40,174,255,.42)", background: "#061b3b",
    color: "#eef8ff", outline: "none"
  };
  const actionStyle = {
    border: "1px solid rgba(0,205,255,.55)", borderRadius: 10,
    background: "linear-gradient(135deg,#0755a8,#06316b)",
    color: "#fff", padding: "10px 14px", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, fontWeight: 700
  };

  return (
    <section style={{
      maxWidth: 1450, margin: "24px auto", padding: "clamp(14px,2vw,26px)",
      color: "#eef8ff"
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 14, marginBottom: 20
      }}>
        <div>
          <button type="button" onClick={onBack} style={{ ...actionStyle, marginBottom: 14 }}>
            <ArrowLeft size={17} /> Back to Home
          </button>
          <div style={{ color: "#00dfff", fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>
            VIMAL HUB · STUDENT READING SPACE
          </div>
          <h1 style={{ margin: "7px 0 4px", fontSize: "clamp(25px,4vw,38px)" }}>
            Multi PDF Viewer
          </h1>
          <p style={{ margin: 0, color: "#a9c9e8" }}>
            Search your academic resources and open several documents side by side.
          </p>
        </div>
        <div style={{
          padding: "10px 14px", border: "1px solid rgba(0,220,255,.45)",
          borderRadius: 12, background: "rgba(0,110,200,.13)", color: "#8feaff",
          display: "flex", gap: 9, alignItems: "center"
        }}>
          <Columns2 size={20} /> {documents.length} document{documents.length === 1 ? "" : "s"} open
        </div>
      </div>

      {!session ? (
        <div style={{
          padding: 28, borderRadius: 16, border: "1px solid #087fc5",
          background: "#061d40", textAlign: "center"
        }}>
          <Files size={42} color="#00dfff" />
          <h2>Student sign-in required</h2>
          <p style={{ color: "#b5cce5" }}>Sign in to search and read your college PDFs.</p>
          <button type="button" style={actionStyle} onClick={onSignIn}>Student sign in</button>
        </div>
      ) : (
        <>
          <form onSubmit={findDocuments} style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
            gap: 12, padding: 16, borderRadius: 16,
            border: "1px solid rgba(0,190,255,.5)", background: "#061a38",
            boxShadow: "0 0 22px rgba(0,132,255,.13)"
          }}>
            <label style={{ color: "#9fdcff", fontSize: 11, fontWeight: 800 }}>
              SEARCH CONTENT
              <input value={term} onChange={(e) => setTerm(e.target.value)}
                placeholder="Search a topic or PDF…" style={{ ...fieldStyle, marginTop: 7 }} />
            </label>
            <label style={{ color: "#9fdcff", fontSize: 11, fontWeight: 800 }}>
              DEPARTMENT
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ ...fieldStyle, marginTop: 7 }}>
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label style={{ color: "#9fdcff", fontSize: 11, fontWeight: 800 }}>
              YEAR
              <select value={year} onChange={(e) => { setYear(e.target.value); setSemester(String(sems[e.target.value][0])); }} style={{ ...fieldStyle, marginTop: 7 }}>
                {[1, 2, 3, 4].map((item) => <option key={item} value={item}>Year {item}</option>)}
              </select>
            </label>
            <label style={{ color: "#9fdcff", fontSize: 11, fontWeight: 800 }}>
              SEMESTER
              <select value={semester} onChange={(e) => setSemester(e.target.value)} style={{ ...fieldStyle, marginTop: 7 }}>
                {sems[year].map((item) => <option key={item} value={item}>Semester {item}</option>)}
              </select>
            </label>
            <label style={{ color: "#9fdcff", fontSize: 11, fontWeight: 800 }}>
              RESOURCE TYPE
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...fieldStyle, marginTop: 7 }}>
                {resourceTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy} style={{ ...actionStyle, alignSelf: "end", minHeight: 44, opacity: busy ? .7 : 1 }}>
              <Search size={17} /> {busy ? "Searching…" : "Search PDFs"}
            </button>
          </form>

          {message && <div role="status" style={{
            marginTop: 12, padding: 12, borderRadius: 10,
            background: "rgba(255,174,40,.12)", border: "1px solid #b77b23",
            color: "#ffe0a1"
          }}>{message}</div>}

          {matches.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 10 }}>Search results · {matches.length} matches</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
                {matches.map((item, index) => (
                  <article key={`${item.id}-${item.page}-${index}`} style={{
                    border: "1px solid rgba(0,190,255,.32)", borderRadius: 12,
                    padding: 13, background: "rgba(4,33,72,.92)"
                  }}>
                    <div style={{ color: "#6fe5ff", fontSize: 11, fontWeight: 800 }}>
                      {item.department} · YEAR {item.year} · SEM {item.semester} · PAGE {item.page}
                    </div>
                    <b style={{ display: "block", margin: "7px 0" }}>{item.title}</b>
                    <p style={{ color: "#b4cce5", fontSize: 13, margin: "0 0 12px" }}>{item.excerpt}</p>
                    <button type="button" style={actionStyle} onClick={() => addDocument(item)}>
                      <Plus size={16} /> Add to viewer
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div style={{
            marginTop: 22, display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 10
          }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Your open documents</h2>
            {maximizedId && <button type="button" style={actionStyle} onClick={() => setMaximizedId(null)}>Show all documents</button>}
          </div>

          {documents.length > 0 && (
            <div style={{
              display: "flex", gap: 7, overflowX: "auto", padding: "12px 0"
            }}>
              {documents.map((doc) => (
                <div key={doc.key} style={{
                  display: "flex", alignItems: "center", gap: 7, flex: "0 0 auto",
                  borderRadius: 9, padding: "7px 9px",
                  border: activeId === doc.key ? "1px solid #00dfff" : "1px solid #315477",
                  background: activeId === doc.key ? "#084b80" : "#071b35"
                }}>
                  <button type="button" onClick={() => { setActiveId(doc.key); setMaximizedId(null); }}
                    style={{ border: 0, background: "transparent", color: "#effaff", cursor: "pointer", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.title}
                  </button>
                  <button type="button" aria-label={`Close ${doc.title}`} onClick={() => removeDocument(doc.key)}
                    style={{ border: 0, background: "transparent", color: "#9fc9e8", cursor: "pointer", padding: 2 }}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {documents.length === 0 ? (
            <div style={{
              marginTop: 12, minHeight: 230, display: "grid", placeItems: "center",
              textAlign: "center", border: "1px dashed #2878a8", borderRadius: 16,
              background: "rgba(4,27,57,.65)", color: "#a9c9e8", padding: 24
            }}>
              <div><Files size={42} color="#00dfff" /><h3 style={{ color: "#eef8ff" }}>No documents open yet</h3>
                <p>Search above, then select “Add to viewer” on each PDF you want to read.</p></div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: maximizedId ? "minmax(0,1fr)" : "repeat(auto-fit,minmax(min(100%,440px),1fr))",
              gap: 12, marginTop: 8
            }}>
              {visibleDocs.map((doc) => (
                <section key={doc.key} style={{
                  minWidth: 0, borderRadius: 13, overflow: "hidden",
                  border: activeId === doc.key ? "1px solid #00dfff" : "1px solid #24557c",
                  background: "#06152b", boxShadow: "0 0 15px rgba(0,125,255,.12)"
                }}>
                  <div style={{
                    minHeight: 48, padding: "8px 11px", display: "flex",
                    alignItems: "center", justifyContent: "space-between", gap: 8,
                    background: "#09264b", borderBottom: "1px solid #174c76"
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</b>
                      <small style={{ color: "#8ebbdc" }}>{doc.subject || doc.resourceType || "Academic PDF"} · Page {doc.page}</small>
                    </div>
                    <div style={{ display: "flex", gap: 5, flex: "0 0 auto" }}>
                      <button type="button" title={maximizedId === doc.key ? "Restore" : "Maximize"}
                        onClick={() => setMaximizedId(maximizedId === doc.key ? null : doc.key)}
                        style={{ ...actionStyle, padding: 8 }}>
                        {maximizedId === doc.key ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                      <button type="button" title="Close document" onClick={() => removeDocument(doc.key)}
                        style={{ ...actionStyle, padding: 8, background: "#51233b", borderColor: "#a74c70" }}>
                        <FileX2 size={16} />
                      </button>
                    </div>
                  </div>
                  <iframe
                    title={`PDF: ${doc.title}`}
                    src={`${doc.pdfUrl}#page=${doc.page || 1}&toolbar=0&navpanes=0`}
                    style={{ display: "block", width: "100%", height: maximizedId === doc.key ? "78vh" : "62vh", border: 0, background: "#fff" }}
                    loading="lazy"
                  />
                </section>
              ))}
            </div>
          )}
          <p style={{ marginTop: 14, color: "#8eabc8", fontSize: 12 }}>
            Reading view: browser PDF controls may vary. Hiding the toolbar is not download protection;
            preventing direct file access requires private Supabase storage and a server-side viewing endpoint.
          </p>
        </>
      )}
    </section>
  );
}
