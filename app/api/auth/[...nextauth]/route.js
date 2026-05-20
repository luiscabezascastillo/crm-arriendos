import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contrasena', type: 'password' },
      },
      async authorize(credentials) {
        const { data: user } = await supabase
          .from('crm_users')
          .select('*')
          .eq('email', credentials.email)
          .eq('auth_provider', 'credentials')
          .eq('activo', true)
          .single()

        if (!user || !user.password_hash) return null

        const ok = await bcrypt.compare(credentials.password, user.password_hash)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.nombre, role: user.rol }
      }
    })
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account.provider === 'google') {
        const { data: user } = await supabase
          .from('crm_users')
          .select('activo')
          .eq('email', profile.email)
          .eq('auth_provider', 'google')
          .single()
        return !!user?.activo
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) token.role = user.role
      if (!token.role) {
        const { data } = await supabase
          .from('crm_users')
          .select('rol, nombre')
          .eq('email', token.email)
          .single()
        if (data) {
          token.role = data.rol
          token.name = data.nombre
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role
      session.user.name = token.name
      return session
    }
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: { strategy: 'jwt' }
})

export { handler as GET, handler as POST }