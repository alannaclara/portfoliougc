/* =========================================================
   CONEXÃO COM O BANCO (SUPABASE)
   Este é o único lugar com o endereço e a chave do seu banco.
   O portfólio, o login e o admin usam este mesmo arquivo.

   A chave abaixo é a chave PÚBLICA (publishable). Ela pode ficar
   aqui sem problema: sozinha, ela só faz o que as regras de
   segurança (RLS) do banco deixam. A chave secreta nunca entra
   em arquivo nenhum do site.

   Antes deste arquivo, a página precisa carregar o Supabase:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js"></script>
   ========================================================= */

window.BANCO_URL = "https://rwlbefdxfnvbupwpkdxm.supabase.co";
window.BANCO_CHAVE = "sb_publishable_tv2nNBYjdyxghXpteQmpIg_RCKMpamg";

// Cria a conexão. Se o Supabase não carregou (sem internet, por exemplo),
// window.banco fica vazio e cada página segue funcionando sem o banco.
window.banco = null;
try {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    window.banco = window.supabase.createClient(window.BANCO_URL, window.BANCO_CHAVE);
  }
} catch (erro) {
  window.banco = null;
}
