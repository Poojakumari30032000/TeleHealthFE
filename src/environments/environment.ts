import {SquareEnv} from "../app/shared/square-env.type";

export const environment = {
  production: false,
  PROTOCOL: 'https',
  FE_PATH: 'https://localhost:4200',
  IAMGE_PATH: 'localhost:7039',
  baseURL: 'localhost:7039/api',
  ROOT_URL: 'localhost:7039',
  LOGO: 'https://www.telehealthus.com/assets/img/impact-health-logo-dark.png',
  fullscript: {
    publicKey: 'X4JIEEXSti_X8H5hS0ulTWeQvG0Y8TZwUR6e5UcyNu0',
    env: 'us-snd' as const,
  },
  squareEnv: 'sandbox' as SquareEnv,
  stripePublishableKey: 'pk_test_51T2dvoGSmn3cdoeg9PBV7ElTQBtKYQ3YQFNxprJIra9sJEvq2ZPWxiw7v1TGA3GwoerXSgVbTXXy1xZLukYt0YGe00DDaWJenK',
};
