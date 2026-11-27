// A EFI acrescenta "/pix" na URL do webhook. Se a URL foi cadastrada sem o
// truque do "&ignorar=", a chamada chega aqui: usamos a mesma lógica.
export { POST } from '../route'
