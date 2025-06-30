import morgan from 'morgan';

export const requestLogger = morgan('combined', {
  skip: (req, res) => process.env.NODE_ENV === 'test'
});

export const devLogger = morgan('dev', {
  skip: (req, res) => process.env.NODE_ENV !== 'development'
}); 