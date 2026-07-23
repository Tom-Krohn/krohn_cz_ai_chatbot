# Vývojářská dokumentace – Databáze a RAG Vyhledávání

Tento dokument slouží k zaznamenání klíčových poznatků o chování vektorového vyhledávání (RAG) v databázi PostgreSQL s rozšířením `pgvector`.

---

## Problém s IVFFlat Indexem (Vyřešeno)

### Popis problému
Při testování dotazů v Chat Sandboxu (např. *"jaké máš sklopce"*) vracelo vyhledávání pouze 3 výsledky z celkových 352 produktů v databázi, přestože klíčové slovo i sémantický význam odpovídaly desítkám dalších produktů (např. *Sklopec 50x17x20*, *Sklopec 82x17x20* atd.). 

### Příčina
V původní databázové migraci byl pro sloupec `embedding` definován index typu `IVFFlat`:
```sql
CREATE INDEX product_embeddings_vector_idx ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
```

`IVFFlat` (Inverted File with Flat Compression) funguje tak, že rozdělí vektorový prostor do shluků (lists). Při vyhledávání se prochází pouze shluky nejbližší dotazu. Počet prohledávaných shluků určuje konfigurační hodnota `ivfflat.probes` (výchozí hodnota je `1`). 

Při malém počtu produktů (352) a nízké hodnotě `probes` databáze prohledala pouze jeden shluk, což vedlo k drastickému snížení přesnosti a ignorování relevantních produktů, které spadly do jiných shluků.

### Řešení
Pro malé a střední datasety (cca do 10 000 až 50 000 položek) je nejlepším řešením **nepoužívat žádný vektorový index**. 
1. PostgreSQL provede přesný sekvenční sken (Exact Nearest Neighbor Search), který je 100% přesný.
2. Pro 352 položek trvá sekvenční vyhledávání méně než **1 milisekundu**.
3. Index `product_embeddings_vector_idx` byl z databáze odstraněn a v migraci `001_initial.sql` zakomentován.

---

## Srovnání Vektorových Indexů v pgvector

### 1. Bez indexu (Sekvenční sken)
- **Přesnost:** 100 % (vždy najde skutečně nejbližší sousedy).
- **Rychlost:** O(N) – roste lineárně s počtem řádků.
- **Doporučení:** Výchozí volba pro katalogy do 10 000 položek.

### 2. HNSW (Hierarchical Navigable Small World)
- **Přesnost:** Vysoká (přibližné vyhledávání - ANN).
- **Rychlost:** O(log N) – extrémně rychlé i pro miliony řádků.
- **Výhody:** Lepší přesnost (recall) než IVFFlat a nevyžaduje trénovací fázi (může se stavět na prázdné tabulce).
- **Nevýhody:** Vyšší nároky na RAM a pomalejší sestavení indexu (build time).
- **Doporučení:** Použít, pokud katalog produktů vyroste nad 10 000–20 000 položek.
- **Příklad vytvoření indexu:**
  ```sql
  CREATE INDEX ON product_embeddings USING hnsw (embedding vector_cosine_ops);
  ```

### 3. IVFFlat
- **Přesnost:** Střední (závisí na správném natrénování a nastavení `probes`).
- **Rychlost:** Velmi vysoká, nízké nároky na paměť.
- **Nevýhody:** Vyžaduje, aby v tabulce již byla data pro správné vytvoření shluků (doporučuje se alespoň 1 000 řádků). Je nutné ladit parametry (počet `lists` při vytváření indexu a `probes` při dotazování).
- **Doporučení:** Vyhnout se mu, pokud nemáte specifické omezení na paměť a miliony záznamů.
