/**
 * Taking money at a counter.
 *
 * Everything a sale needs regardless of what is being sold: who the customer is, proof that they
 * are who they say, which physical unit they are getting, and how it gets paid for. The activity
 * wizards compose these — they do not reimplement them.
 */
export { ConfirmCustomer } from './ConfirmCustomer'
export { CustomerPicker } from './CustomerPicker'
export { InstancePicker } from './InstancePicker'
export { PaymentPanel, usePaymentSplits } from './PaymentPanel'
export { SecondPayerSheet, type SecondPayer } from './SecondPayerSheet'
export { FREE, boatAsUnit, isFree, seatsCaption, unitCaption, unitsForEngine, unitsOfKind } from './model'
