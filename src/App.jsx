
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
