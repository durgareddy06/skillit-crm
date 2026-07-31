import { useEffect, useMemo, useState } from "react";
import { listModules } from "../api/admin";
import { getModuleTemplateActions, cloneActions } from "../config/settingsWorkspace";

export function useModuleActionFields(moduleKey, actionKey) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
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

    load();
    const handleRefresh = () => load();
    window.addEventListener("module-config-updated", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      alive = false;
      window.removeEventListener("module-config-updated", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [moduleKey, actionKey]);

  const fields = useMemo(() => {
    const module = modules.find((item) => item.key === moduleKey) || null;
    const actions = module?.actions?.length ? cloneActions(module.actions) : getModuleTemplateActions(moduleKey, module?.label);
    const action = actions.find((item) => item.key === actionKey) || actions.find((item) => item.key === `create-${moduleKey}`);
    return Array.isArray(action?.fields) ? action.fields : [];
  }, [modules, moduleKey, actionKey]);

  return { fields, loading, modules };
}
