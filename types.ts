
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string;
  status?: 'PENDING' | 'APPROVED' | 'BLOCKED';
  isAdmin?: boolean;
  theme?: 'light' | 'dark';
  tutorialEnabled?: boolean;
  hasCompletedTutorial?: boolean;
  hasCompletedTransactionTutorial?: boolean;
  companyName?: string;
  companyDocument?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyCep?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface Bank {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  supplierId?: string;
  bankId: string;
  paymentMethod: string;
  date: string;
  status: 'PENDING' | 'PAID';
  isFixed?: boolean;
  installmentsCount?: number;
  installmentNumber?: number;
  groupId?: string;
  customInstallments?: {
    number: number;
    dueDate: string;
    amount: number;
  }[];
}

export type View = 'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'SETTINGS' | 'BUDGETS' | 'CLIENTS' | 'APPOINTMENTS';

export interface Appointment {
  id: string;
  userId: string;
  clientId?: string;
  client: ClientData;
  date: string;
  time: string;
  serviceDescription: string;
  equipment?: string;
  totalAmount: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  notes?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;          // Nome do Cliente / Razão Social
  tradeName?: string;    // Nome Fantasia
  document: string;      // CPF/CNPJ
  cep?: string;          // CEP
  address?: string;      // Logradouro (Rua, Av, etc)
  number?: string;       // Número
  complement?: string;   // Complemento
  bairro?: string;       // Bairro
  city?: string;         // Cidade
  state?: string;        // UF
  reference?: string;    // Referência
  contact?: string;      // Contato (Telefone/WhatsApp)
  email?: string;        // E-mail
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  total: number;
  discount?: number;
  observation?: string;
}

export interface ClientData {
  name?: string;
  address?: string;
  number?: string;
  complement?: string;
  contact?: string;
  document?: string;
  cep?: string;
  email?: string;
}

export interface Budget {
  id: string;
  userId: string;
  client: ClientData;
  items: BudgetItem[];
  totalAmount: number;
  discount?: number;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  notes?: string;
  createdAt: string;
  number?: number;
  installments?: BudgetInstallment[];
}

export interface BudgetInstallment {
  number: number;
  amount: number;
  dueDate: string;
  paymentMethod: string;
}
