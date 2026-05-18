const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  // Identification
  idImmeuble: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idImmeubleSysteme: {
    type: String,
    required: true,
    unique: true
  },
  
  // Location
  ville: {
    type: String,
    required: true,
    index: true
  },
  zone: {
    type: String,
    default: '',
    index: true
  },
  codePostal: {
    type: String,
    required: true
  },
  longitude: {
    type: String,
    default: ''
  },
  latitude: {
    type: String,
    default: ''
  },
  rueNomNom: {
    type: String,
    required: true
  },
  numeroNomImmeuble: {
    type: String,
    required: true
  },
  
  // Building Characteristics
  utilisationImmeuble: {
    type: String,
    default: ''
  },
  nbreEtages: {
    type: String,
    default: '0'
  },
  /** JSON string: { "0": "4", "1": "6", ... } — index 0 = RDC, puis chaque étage au-dessus */
  nbreAppartementsParEtage: {
    type: String,
    default: ''
  },
  sousSol: {
    type: String,
    default: '0'
  },
  sousSolCommun: {
    type: String,
    default: ''
  },
  typologieHabitat: {
    type: String,
    default: ''
  },
  verticalite: {
    type: String,
    default: ''
  },
  csp: {
    type: String,
    default: ''
  },
  
  // Fiber Connection
  solutionRaccordement: {
    type: String,
    default: ''
  },
  
  // Client Statistics
  nbrB2B: {
    type: String,
    default: '0'
  },
  nbrB2C: {
    type: String,
    default: '0'
  },
  totalClients: {
    type: String,
    default: '0'
  },
  
  // PBO (Point de Branchement Optique)
  cheminFibrePBO1: {
    type: String,
    default: ''
  },
  bpo1: {
    type: String,
    default: ''
  },
  floorPBO1: {
    type: String,
    default: ''
  },
  typePBO1: {
    type: String,
    default: ''
  },
  PBO2: {
    type: String,
    default: ''
  },
  floorPBO2: {
    type: String,
    default: ''
  },
  typePBO2: {
    type: String,
    default: ''
  },
  
  // Syndic Information
  syndic: {
    type: String,
    default: ''
  },
  numSyndic: {
    type: String,
    default: ''
  },
  /** data:image/png;base64,... — signature manuscrite syndic (autorisation installation) */
  syndicInstallationAuthSignature: {
    type: String,
    default: ''
  },
  /** ISO 8601 — date/heure de la signature */
  syndicInstallationAuthSignedAt: {
    type: String,
    default: ''
  },
  
  // Remarks
  remarques: {
    type: String,
    default: ''
  },
  
  // Metadata
  serviceId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    default: 'active',
    index: true
  },
  
  // Timestamps
  lastModified: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for photos
buildingSchema.virtual('photos', {
  ref: 'Photo',
  localField: '_id',
  foreignField: 'buildingId'
});

// Pre-save middleware to update lastModified
buildingSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Indexes for common queries
buildingSchema.index({ ville: 1, status: 1 });
buildingSchema.index({ serviceId: 1, status: 1 });
buildingSchema.index({ idImmeuble: 'text', rueNomNom: 'text', syndic: 'text' });

module.exports = mongoose.model('Building', buildingSchema);
