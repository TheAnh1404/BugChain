import { Module } from '@nestjs/common';
import { UserProofsController } from './user-proofs.controller';
import { UserProofsService } from './user-proofs.service';

@Module({
  controllers: [UserProofsController],
  providers: [UserProofsService],
  exports: [UserProofsService],
})
export class UserProofsModule {}
