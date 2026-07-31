import { useEffect, useMemo, useRef, useState } from "react";
import { listModules } from "../api/admin";
import { cloneModuleConfig } from "../config/settingsWorkspace";

const REFETCH_COOLDOWN_MS = 30000; // 30 seconds

export function useModuleConfig(moduleKey) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = (force = false) => {
      // Cooldown: skip if we fetched less than 30 seconds ago (unless forced)
      const now = Date.now();
      if (!force && now - lastFetchRef.current < REFETCH_COOLDOWN_MS) return;
      lastFetchRef.current = now;

      setLoading(true);
      listModules()
        .then((mods) => {
          if (!alive) return;
          setModules(Array.isArray(mods) ? mods : []);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    };

    load(true); // first load always fetches
    const handleRefresh = () => load(true); // explicit config update always fetches
    const handleFocus = () => load(false); // focus uses cooldown
    window.addEventListener("module-config-updated", handleRefresh);
    window.addEventListener("focus", handleFocus);
    return () => {
      alive = false;
      window.removeEventListener("module-config-updated", handleRefresh);
      window.removeEventListener("focus", handleFocus);
    };
  }, [moduleKey]);

  const module = useMemo(() => modules.find((item) => item.key === moduleKey) || null, [modules, moduleKey]);
  const config = useMemo(() => cloneModuleConfig(module?.config || {}, module?.key, module?.label), [module]);

  return { module, config, loading, modules };
}
