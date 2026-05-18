/**
 * Helper client to query Supabase REST API (PostgREST) directly inside Obsidian DataviewJS.
 */
class SupabaseObsidianClient {
  constructor(url, key) {
    this.baseUrl = url ? `${url}/rest/v1` : '';
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  static async init(app) {
    try {
      const configPath = '99_System/config.json';
      const file = app.vault.getAbstractFileByPath(configPath);
      if (!file) throw new Error(`Config file not found at ${configPath}`);
      
      const text = await app.vault.read(file);
      const config = JSON.parse(text);
      return new SupabaseObsidianClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    } catch (err) {
      console.error('SupabaseObsidianClient init error:', err);
      return new SupabaseObsidianClient('', '');
    }
  }

  async fetchTable(tableName, queryParams = 'select=*') {
    if (!this.baseUrl) return [];
    try {
      const res = await fetch(`${this.baseUrl}/${tableName}?${queryParams}`, {
        headers: this.headers
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Error fetching table ${tableName}:`, err);
      return [];
    }
  }

  async getAccounts() {
    return await this.fetchTable('accounts', 'select=id,name,type,current_balance,currency&order=name.asc');
  }

  async getDebtsWithPeople() {
    // Fetch debts and people separately or via join if foreign key is configured correctly in postgrest
    const debts = await this.fetchTable('debts', 'select=id,person_id,debt_role,original_amount,repaid_amount,remaining_amount,status,notes,occurred_at&status=in.(pending,partial)&order=occurred_at.asc');
    const people = await this.fetchTable('people', 'select=id,name');
    
    const peopleMap = {};
    people.forEach(p => peopleMap[p.id] = p.name);

    return debts.map(d => ({
      ...d,
      person_name: peopleMap[d.person_id] || 'Unknown'
    }));
  }

  async getActiveCashbackCycles() {
    return await this.fetchTable('cashback_cycles', 'select=*&status=eq.active&order=cycle_tag.desc');
  }
}

module.exports = SupabaseObsidianClient;
