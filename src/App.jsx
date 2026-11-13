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
