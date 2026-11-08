
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  Search, BookOpen, FileText, FlaskConical, GraduationCap,
  ArrowUpRight, Sparkles, Menu, X, UploadCloud, LibraryBig,
  Layers3, Command, CheckCircle2, BookMarked, Crown, LogIn,
  LogOut, Mail, BadgeIndianRupee
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
  const verses = [
    { text: "Trust in the Lord with all your heart", ref: "PROVERBS 3:5" },
    { text: "I can do all things through Christ who strengthens me", ref: "PHILIPPIANS 4:13" },
    { text: "Be strong and courageous. Do not be afraid", ref: "JOSHUA 1:9" },
    { text: "The Lord is my strength and my shield", ref: "PSALM 28:7" },
    { text: "Commit your work to the Lord", ref: "PROVERBS 16:3" },
    { text: "Let all that you do be done in love", ref: "1 CORINTHIANS 16:14" }
  ];
  const [verseIndex, setVerseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVerseIndex((current) => (current + 1) % verses.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <div className="app">
      <header className="nav">
        <a className="brand" href="#">
          <span className="brandicon"><LibraryBig /></span>
          <span>
            CAMPUS<span className="gold">HUB</span>
            <small>ACADEMIC RESOURCE NETWORK</small>
          </span>
        </a>

        <button className="hamb" onClick={() => setMenu(!menu)}>
          {menu ? <X /> : <Menu />}
        </button>

        <nav className={menu ? "links show" : "links"}>
          <a href="#explore">Explore</a>
          <a href="#features">Resources</a>
          <a href="#how">How it works</a>

          {session ? (
            <button onClick={signOut}>
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <button onClick={() => setAuthOpen(true)}>
              <LogIn size={15} /> Student sign in
            </button>
          )}

          <button onClick={() => setAdmin(true)}>
            <UploadCloud size={15} /> Admin upload
          </button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <i /> THE KNOWLEDGE YOU NEED, ONE SEARCH AWAY
            </div>

            <h1>
              Study with <em>clarity.</em>
              <br />
              Find it with <span>intelligence.</span>
            </h1>

            <p>
              A smarter academic library for every department. Search concepts
              inside notes and question papers — even when you don't know which
              unit contains them.
            </p>

            <div className="actions">
              <a className="primary" href="#explore">
                Explore resources <ArrowUpRight size={17} />
              </a>
              <a className="secondary" href="#how">
                See how it works ↗
              </a>
            </div>

            <div className="proof">
              ✦ &nbsp;All departments · All semesters · All five units
            </div>
          </div>

          <div className="art command-art" aria-label="VIMAL futuristic academic command centre">
            <div className="art-grid" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="command-core">
              <div className="core-glow" />
              <div className="core-symbol"><LibraryBig size={76} strokeWidth={1.15} /></div>
              <div className="core-label">KNOWLEDGE ENGINE</div>
              <div className="core-name">VIMAL<span>_</span></div>
              <div className="core-caption">COLLEGE HUB · INTELLIGENCE NETWORK</div>
            </div>
            <div className="founder-card">
              <small>FOUNDED & DESIGNED BY</small>
              <b>VIMAL</b>
              <span>Engineering knowledge into possibility.</span>
            </div>
            <div className="float f1">
              <Search />
              <span><b>CONCEPT SEARCH</b><small>Find topics across units</small></span>
              <CheckCircle2 />
            </div>
            <div className="float f2">
              <FileText />
              <span><b>PAGE INTELLIGENCE</b><small>Open the exact PDF page</small></span>
            </div>
            <div className="signal-tag"><i /> SYSTEM ONLINE <span>98.7%</span></div>
            <div className="art-index">VCH / 2026 <span>•</span> ACADEMIC AI</div>
          </div>

          <div className="verse-ribbon" aria-live="polite">
            <div className="verse-mark">✦</div>
            <div className="verse-copy">
              <small>DAILY WORD · SCRIPTURE IN MOTION</small>
              <div key={verseIndex} className="verse-text">“{verses[verseIndex].text}”</div>
            </div>
            <div className="verse-reference">{verses[verseIndex].ref}</div>
            <div className="verse-progress"><span key={verseIndex} /></div>
          </div>

          <div className="hero-foot">
            <span>01 / YOUR ACADEMIC COMPANION</span>
            <span>SCROLL TO DISCOVER ↓</span>
          </div>
        </section>

        <section className="section account-area" aria-label="Student account and membership">
          <div className="account-card">
            <div>
              <div className="eyebrow dark">STUDENT SEARCH PASS</div>

              <h3>
                {session
                  ? `Welcome, ${session.user.email}`
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
      </main>

      <footer>
        <div className="brand">
          <span className="brandicon"><LibraryBig /></span>
          CAMPUS<span className="gold">HUB</span>
        </div>
        <p>
          Created by <b>Vimal</b> · A better way to find what you need to learn.
        </p>
        <small>
          © {new Date().getFullYear()} CAMPUS ACADEMIC HUB ·{" "}
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
