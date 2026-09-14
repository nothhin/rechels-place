import styles from "./admin.module.css";

export default function AdminLoading() {
  return (
    <main className={styles.dashboardShell} aria-busy="true" aria-label="Loading admin workspace">
      <aside className={styles.sidebar}>
        <div className={styles.adminBrand}>
          <div className={styles.loadingMark} />
          <div className={styles.loadingStack}><span /><span /></div>
        </div>
        <div className={styles.loadingNav}>
          {[1, 2, 3, 4, 5, 6].map((item) => <span key={item} />)}
        </div>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}><span className={styles.loadingLine} /><span className={styles.loadingLineShort} /></header>
        <div className={styles.content}>
          <section className={styles.loadingHero}><span /><i /><i /></section>
          <section className={styles.loadingMetrics}>{[1, 2, 3, 4].map((item) => <article key={item} />)}</section>
          <section className={styles.loadingPanel}><span /><span /><span /><span /></section>
        </div>
      </section>
    </main>
  );
}
